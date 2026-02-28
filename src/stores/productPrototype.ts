import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { projectApi } from '@/api/projectApi'
import type {
  TaskStatus,
  TaskLogType,
  TaskLog,
  TaskLogInput,
  PrototypePage,
  PrototypeData,
  PrototypeVersion,
  PrototypeProject,
  GenerateProgress,
  GenStep
} from '@/electron.d'

// 重新导出类型
export type { TaskStatus, TaskLogType, TaskLog, PrototypePage, PrototypeData, PrototypeVersion, PrototypeProject, GenerateProgress, GenStep }

const MAX_VERSIONS = 10

// 检查是否在 Electron 环境中
const isElectron = () => typeof window !== 'undefined' && window.electronAPI

export const useProductPrototypeStore = defineStore('productPrototype', () => {
  const tasks = ref<PrototypeProject[]>([])
  const currentTask = ref<PrototypeProject | null>(null)
  const currentPageIndex = ref<number>(0)
  const currentTaskLogs = ref<TaskLog[]>([])
  const loading = ref(false)

  // ────────────────────────────────────────────────────────────
  // 数据库操作方法
  // ────────────────────────────────────────────────────────────

  /** 从数据库加载所有任务 */
  async function loadTasks() {
    if (!isElectron()) return
    loading.value = true
    try {
      const result = await projectApi.getProjects()
      if (result.success && result.data) {
        tasks.value = result.data
      }
    } catch (err) {
      console.error('[PrototypeStore] 加载任务失败:', err)
    } finally {
      loading.value = false
    }
  }

  /** 从数据库加载单个任务 */
  async function loadTask(id: string) {
    if (!isElectron()) return null
    loading.value = true
    try {
      const result = await projectApi.getProject(id)
      if (result.success && result.data) {
        currentTask.value = result.data
        // 同时更新列表中的任务
        const idx = tasks.value.findIndex(p => p.id === id)
        if (idx !== -1) {
          tasks.value[idx] = result.data
        }
        // 加载任务日志
        await loadTaskLogs(id)
        return result.data
      }
      return null
    } finally {
      loading.value = false
    }
  }

  /** 加载任务日志 */
  async function loadTaskLogs(taskId: string) {
    if (!isElectron()) return
    try {
      const result = await projectApi.getLogs(taskId)
      if (result.success && result.data) {
        currentTaskLogs.value = result.data
      }
    } catch (err) {
      console.error('加载日志失败:', err)
    }
  }

  /** 保存任务到数据库 */
  async function saveTaskToDB(task: PrototypeProject) {
    if (!isElectron()) return task
    try {
      const result = await projectApi.saveProject(JSON.parse(JSON.stringify(task)))
      if (result.success && result.data) {
        return result.data
      }
    } catch (err) {
      console.error('保存任务失败:', err)
    }
    return task
  }

  /** 从数据库删除任务 */
  async function deleteTaskFromDB(id: string) {
    if (!isElectron()) return false
    try {
      const result = await projectApi.deleteProject(id)
      return result.success
    } catch (err) {
      console.error('删除任务失败:', err)
      return false
    }
  }

  /** 添加日志 */
  async function addLog(taskId: string, type: TaskLogType, message: string, detail?: string) {
    const logInput: TaskLogInput = {
      taskId,
      type,
      message,
      detail,
      timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }

    if (isElectron()) {
      try {
        const result = await projectApi.addLog(JSON.parse(JSON.stringify(logInput)))
        if (result.success && result.data) {
          // 添加到当前日志列表的开头
          currentTaskLogs.value.unshift(result.data)
          return result.data
        }
      } catch (err) {
        console.error('添加日志失败:', err)
      }
    }

    // 非 Electron 环境或失败时，只在内存中添加
    const localLog: TaskLog = {
      ...logInput,
      id: `log_${Date.now()}`
    }
    currentTaskLogs.value.unshift(localLog)
    return localLog
  }

  // ────────────────────────────────────────────────────────────
  // 项目操作方法
  // ────────────────────────────────────────────────────────────

  async function createTask(data: Omit<PrototypeProject, 'id' | 'createdAt' | 'updatedAt' | 'versions' | 'status'>): Promise<PrototypeProject> {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const project: PrototypeProject = {
      ...data,
      id: `pp_${Date.now()}`,
      status: 'pending',
      versions: [],
      createdAt: now,
      updatedAt: now
    }

    // 保存到数据库
    const saved = await saveTaskToDB(project)

    // 更新本地状态
    tasks.value.unshift(saved)
    if (tasks.value.length > 50) {
      tasks.value = tasks.value.slice(0, 50)
    }
    currentTask.value = saved

    // 记录创建日志
    await addLog(saved.id, 'create', `创建任务: ${saved.title}`)

    return saved
  }

  /** 更新任务状态和进度 */
  async function updateTaskStatus(id: string, status: TaskStatus, progress?: Partial<GenerateProgress>, errorMessage?: string) {
    if (isElectron()) {
      try {
        const cleanProgress = progress ? JSON.parse(JSON.stringify(progress)) : undefined
        const result = await projectApi.updateStatusProgress(id, status, cleanProgress, errorMessage)
        if (result.success && result.data) {
          // 更新本地状态
          const idx = tasks.value.findIndex(p => p.id === id)
          if (idx !== -1) {
            tasks.value[idx] = result.data
          }
          if (currentTask.value?.id === id) {
            currentTask.value = result.data
          }
        }
      } catch (err) {
        console.error('更新状态失败:', err)
      }
    } else {
      // 非 Electron 环境
      const project = tasks.value.find(p => p.id === id)
      if (project) {
        project.status = status
        project.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
        if (progress) project.progress = { ...project.progress, ...progress } as GenerateProgress
        if (errorMessage) project.errorMessage = errorMessage
        if (currentTask.value?.id === id) {
          currentTask.value = { ...project }
        }
      }
    }

    // 记录状态变更日志
    const statusMap: Record<TaskStatus, string> = {
      pending: '待生成',
      generating: '生成中',
      completed: '已完成',
      failed: '失败'
    }
    const project = tasks.value.find(p => p.id === id)
    if (project) {
      await addLog(id, 'status_change', `状态变更: → ${statusMap[status]}`, errorMessage)
    }
  }

  /** 启动生成任务 */
  async function startTask(
    projectId: string,
    apiKey: string,
    baseUrl: string,
    model?: string,
    prompts?: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> {
    const cleanPrompts = prompts ? JSON.parse(JSON.stringify(prompts)) : undefined
    const result = await projectApi.startGenerate(projectId, apiKey, baseUrl, model, cleanPrompts)
    if (result.success) {
      await loadTask(projectId)
    }
    return result
  }

  /** 取消生成任务 */
  async function cancelTask(projectId: string): Promise<{ success: boolean; error?: string }> {
    const result = await projectApi.cancelGenerate(projectId)
    if (result.success) {
      await loadTask(projectId)
    }
    return result
  }

  /** 更新任务进度（自动更新心跳时间戳） */
  async function updateTaskProgress(id: string, progress: Partial<GenerateProgress>) {
    // 自动添加心跳时间戳
    const progressWithHeartbeat = {
      ...progress,
      lastHeartbeat: new Date().toISOString()
    }

    if (isElectron()) {
      try {
        const result = await projectApi.updateProgress(id, JSON.parse(JSON.stringify(progressWithHeartbeat)))
        if (result.success && result.data) {
          // 更新本地状态
          const idx = tasks.value.findIndex(p => p.id === id)
          if (idx !== -1) {
            tasks.value[idx] = result.data
          }
          if (currentTask.value?.id === id) {
            currentTask.value = result.data
          }
          return result.data
        }
      } catch (err) {
        console.error('更新进度失败:', err)
      }
    } else {
      // 非 Electron 环境
      const project = tasks.value.find(p => p.id === id)
      if (project) {
        project.progress = { ...project.progress, ...progressWithHeartbeat } as GenerateProgress
        project.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
        if (currentTask.value?.id === id) {
          currentTask.value = { ...project }
        }
        return project
      }
    }
    return null
  }

  /** 根据 ID 获取项目 */
  function getTaskById(id: string): PrototypeProject | undefined {
    return tasks.value.find(p => p.id === id)
  }

  /** 保存当前状态为一个版本快照 */
  async function saveVersion(description = '手动保存') {
    if (!currentTask.value?.data) return
    const version: PrototypeVersion = {
      id: `v_${Date.now()}`,
      data: JSON.parse(JSON.stringify(currentTask.value.data)),
      savedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      description
    }
    currentTask.value.versions.unshift(version)
    if (currentTask.value.versions.length > MAX_VERSIONS) {
      currentTask.value.versions = currentTask.value.versions.slice(0, MAX_VERSIONS)
    }
    await syncCurrentToList()
  }

  /** 恢复到某个版本 */
  async function restoreVersion(versionId: string) {
    if (!currentTask.value) return
    const version = currentTask.value.versions.find(v => v.id === versionId)
    if (version) {
      currentTask.value.data = JSON.parse(JSON.stringify(version.data))
      await syncCurrentToList()
    }
  }

  /** 更新原型数据 */
  async function updatePrototypeData(data: PrototypeData) {
    if (!currentTask.value) return
    currentTask.value.data = data
    currentTask.value.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
    await syncCurrentToList()
  }

  /** 更新单个页面的 HTML 内容 */
  async function updatePageHtml(pageIndex: number, htmlContent: string) {
    if (!currentTask.value?.data) return
    const page = currentTask.value.data.pages[pageIndex]
    if (!page) return
    page.htmlContent = htmlContent
    currentTask.value.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
    await syncCurrentToList()
  }

  /** 更新单个页面的提示词 */
  async function updatePagePrompt(pageIndex: number, prompt: string) {
    if (!currentTask.value?.data) return
    const page = currentTask.value.data.pages[pageIndex]
    if (!page) return
    page.prompt = prompt
    currentTask.value.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
    await syncCurrentToList()
  }

  async function deleteTask(id: string) {
    // 从数据库删除
    await deleteTaskFromDB(id)

    // 从本地状态删除
    tasks.value = tasks.value.filter(p => p.id !== id)
    if (currentTask.value?.id === id) {
      currentTask.value = null
    }
    return true
  }

  function setCurrentTask(project: PrototypeProject | null) {
    currentTask.value = project
    currentPageIndex.value = 0
    // 清空当前日志
    currentTaskLogs.value = []
  }

  async function syncCurrentToList() {
    if (!currentTask.value) return
    const idx = tasks.value.findIndex(p => p.id === currentTask.value!.id)
    if (idx !== -1) {
      tasks.value[idx] = { ...currentTask.value }
    }
    // 保存到数据库
    await saveTaskToDB(currentTask.value)
  }

  // ────────────────────────────────────────────────────────────
  // 计算属性
  // ────────────────────────────────────────────────────────────

  const generatingCount = computed(() => tasks.value.filter(t => t.status === 'generating').length)
  const completedCount = computed(() => tasks.value.filter(t => t.status === 'completed').length)

  return {
    tasks,
    currentTask,
    currentPageIndex,
    currentTaskLogs,
    loading,
    generatingCount,
    completedCount,
    // 数据库方法
    loadTasks,
    loadTask,
    addLog,
    // 项目方法
    createTask,
    updateTaskStatus,
    updateTaskProgress,
    startTask,
    cancelTask,
    getTaskById,
    saveVersion,
    restoreVersion,
    updatePrototypeData,
    updatePageHtml,
    updatePagePrompt,
    deleteTask,
    setCurrentTask
  }
})
