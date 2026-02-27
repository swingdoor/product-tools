import { defineStore } from 'pinia'
import { ref } from 'vue'
import dayjs from 'dayjs'
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
  const projects = ref<PrototypeProject[]>([])
  const currentProject = ref<PrototypeProject | null>(null)
  const currentPageIndex = ref<number>(0)
  const taskLogs = ref<TaskLog[]>([])
  const isLoading = ref(false)

  // ────────────────────────────────────────────────────────────
  // 数据库操作方法
  // ────────────────────────────────────────────────────────────

  /** 从数据库加载所有项目 */
  async function loadProjectsFromDB() {
    if (!isElectron()) return
    isLoading.value = true
    try {
      const result = await window.electronAPI.dbGetProjects()
      if (result.success && result.data) {
        projects.value = result.data
      }
    } finally {
      isLoading.value = false
    }
  }

  /** 从数据库加载单个项目 */
  async function loadProjectFromDB(id: string) {
    if (!isElectron()) return null
    isLoading.value = true
    try {
      const result = await window.electronAPI.dbGetProject(id)
      if (result.success && result.data) {
        currentProject.value = result.data
        // 同时更新列表中的项目
        const idx = projects.value.findIndex(p => p.id === id)
        if (idx !== -1) {
          projects.value[idx] = result.data
        }
        // 加载项目日志
        await loadLogsFromDB(id)
        return result.data
      }
      return null
    } finally {
      isLoading.value = false
    }
  }

  /** 保存项目到数据库 */
  async function saveProjectToDB(project: PrototypeProject) {
    if (!isElectron()) return project
    try {
      const result = await window.electronAPI.dbSaveProject(project)
      if (result.success && result.data) {
        return result.data
      }
    } catch (err) {
      console.error('保存项目失败:', err)
    }
    return project
  }

  /** 从数据库删除项目 */
  async function deleteProjectFromDB(id: string) {
    if (!isElectron()) return false
    try {
      const result = await window.electronAPI.dbDeleteProject(id)
      return result.success
    } catch (err) {
      console.error('删除项目失败:', err)
      return false
    }
  }

  /** 加载项目日志 */
  async function loadLogsFromDB(taskId: string) {
    if (!isElectron()) return
    try {
      const result = await window.electronAPI.dbGetLogs(taskId)
      if (result.success && result.data) {
        taskLogs.value = result.data
      }
    } catch (err) {
      console.error('加载日志失败:', err)
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
        const result = await window.electronAPI.dbAddLog(logInput)
        if (result.success && result.data) {
          // 添加到当前日志列表的开头
          taskLogs.value.unshift(result.data)
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
    taskLogs.value.unshift(localLog)
    return localLog
  }

  // ────────────────────────────────────────────────────────────
  // 项目操作方法
  // ────────────────────────────────────────────────────────────

  async function createProject(data: Omit<PrototypeProject, 'id' | 'createdAt' | 'updatedAt' | 'versions' | 'status'>): Promise<PrototypeProject> {
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
    const saved = await saveProjectToDB(project)

    // 更新本地状态
    projects.value.unshift(saved)
    if (projects.value.length > 50) {
      projects.value = projects.value.slice(0, 50)
    }
    currentProject.value = saved

    // 记录创建日志
    await addLog(saved.id, 'create', `创建任务: ${saved.title}`)

    return saved
  }

  /** 更新任务状态和进度 */
  async function updateProjectStatus(id: string, status: TaskStatus, progress?: Partial<GenerateProgress>, errorMessage?: string) {
    if (isElectron()) {
      try {
        const result = await window.electronAPI.dbUpdateStatusProgress(id, status, progress, errorMessage)
        if (result.success && result.data) {
          // 更新本地状态
          const idx = projects.value.findIndex(p => p.id === id)
          if (idx !== -1) {
            projects.value[idx] = result.data
          }
          if (currentProject.value?.id === id) {
            currentProject.value = result.data
          }
        }
      } catch (err) {
        console.error('更新状态失败:', err)
      }
    } else {
      // 非 Electron 环境
      const project = projects.value.find(p => p.id === id)
      if (project) {
        project.status = status
        project.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
        if (progress) project.progress = { ...project.progress, ...progress } as GenerateProgress
        if (errorMessage) project.errorMessage = errorMessage
        if (currentProject.value?.id === id) {
          currentProject.value = { ...project }
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
    const project = projects.value.find(p => p.id === id)
    if (project) {
      await addLog(id, 'status_change', `状态变更: → ${statusMap[status]}`, errorMessage)
    }
  }

  /** 更新任务进度（自动更新心跳时间戳） */
  async function updateProjectProgress(id: string, progress: Partial<GenerateProgress>) {
    // 自动添加心跳时间戳
    const progressWithHeartbeat = {
      ...progress,
      lastHeartbeat: new Date().toISOString()
    }
    
    if (isElectron()) {
      try {
        const result = await window.electronAPI.dbUpdateProgress(id, progressWithHeartbeat)
        if (result.success && result.data) {
          // 更新本地状态
          const idx = projects.value.findIndex(p => p.id === id)
          if (idx !== -1) {
            projects.value[idx] = result.data
          }
          if (currentProject.value?.id === id) {
            currentProject.value = result.data
          }
          return result.data
        }
      } catch (err) {
        console.error('更新进度失败:', err)
      }
    } else {
      // 非 Electron 环境
      const project = projects.value.find(p => p.id === id)
      if (project) {
        project.progress = { ...project.progress, ...progressWithHeartbeat } as GenerateProgress
        project.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
        if (currentProject.value?.id === id) {
          currentProject.value = { ...project }
        }
        return project
      }
    }
    return null
  }

  /** 根据 ID 获取项目 */
  function getProjectById(id: string): PrototypeProject | undefined {
    return projects.value.find(p => p.id === id)
  }

  /** 保存当前状态为一个版本快照 */
  async function saveVersion(description = '手动保存') {
    if (!currentProject.value?.data) return
    const version: PrototypeVersion = {
      id: `v_${Date.now()}`,
      data: JSON.parse(JSON.stringify(currentProject.value.data)),
      savedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      description
    }
    currentProject.value.versions.unshift(version)
    if (currentProject.value.versions.length > MAX_VERSIONS) {
      currentProject.value.versions = currentProject.value.versions.slice(0, MAX_VERSIONS)
    }
    await syncCurrentToList()
  }

  /** 恢复到某个版本 */
  async function restoreVersion(versionId: string) {
    if (!currentProject.value) return
    const version = currentProject.value.versions.find(v => v.id === versionId)
    if (version) {
      currentProject.value.data = JSON.parse(JSON.stringify(version.data))
      await syncCurrentToList()
    }
  }

  /** 更新原型数据 */
  async function updatePrototypeData(data: PrototypeData) {
    if (!currentProject.value) return
    currentProject.value.data = data
    currentProject.value.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
    await syncCurrentToList()
  }

  /** 更新单个页面的 HTML 内容 */
  async function updatePageHtml(pageIndex: number, htmlContent: string) {
    if (!currentProject.value?.data) return
    const page = currentProject.value.data.pages[pageIndex]
    if (!page) return
    page.htmlContent = htmlContent
    currentProject.value.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
    await syncCurrentToList()
  }

  /** 更新单个页面的提示词 */
  async function updatePagePrompt(pageIndex: number, prompt: string) {
    if (!currentProject.value?.data) return
    const page = currentProject.value.data.pages[pageIndex]
    if (!page) return
    page.prompt = prompt
    currentProject.value.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
    await syncCurrentToList()
  }

  async function deleteProject(id: string) {
    // 从数据库删除
    await deleteProjectFromDB(id)

    // 从本地状态删除
    projects.value = projects.value.filter(p => p.id !== id)
    if (currentProject.value?.id === id) {
      currentProject.value = null
    }
  }

  function setCurrentProject(project: PrototypeProject | null) {
    currentProject.value = project
    currentPageIndex.value = 0
    // 清空当前日志
    taskLogs.value = []
  }

  async function syncCurrentToList() {
    if (!currentProject.value) return
    const idx = projects.value.findIndex(p => p.id === currentProject.value!.id)
    if (idx !== -1) {
      projects.value[idx] = { ...currentProject.value }
    }
    // 保存到数据库
    await saveProjectToDB(currentProject.value)
  }

  return {
    projects,
    currentProject,
    currentPageIndex,
    taskLogs,
    isLoading,
    // 数据库方法
    loadProjectsFromDB,
    loadProjectFromDB,
    addLog,
    // 项目方法
    createProject,
    updateProjectStatus,
    updateProjectProgress,
    getProjectById,
    saveVersion,
    restoreVersion,
    updatePrototypeData,
    updatePageHtml,
    updatePagePrompt,
    deleteProject,
    setCurrentProject
  }
})
