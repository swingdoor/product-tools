import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { designDocApi } from '@/api/designDocApi'
import type { DesignDoc, TaskLog, TaskStatus, PrototypeProject } from '@/electron.d'

export type { DesignDoc, TaskLog, TaskStatus }

export const useDesignDocStore = defineStore('designDoc', () => {
  // 任务列表
  const tasks = ref<DesignDoc[]>([])
  // 当前任务
  const currentTask = ref<DesignDoc | null>(null)
  // 当前任务日志
  const currentTaskLogs = ref<TaskLog[]>([])
  // 加载状态
  const loading = ref(false)

  // ────────────────────────────────────────────────────────────
  // 数据库操作方法
  // ────────────────────────────────────────────────────────────

  /** 加载所有任务 */
  async function loadTasks() {
    loading.value = true
    try {
      const result = await designDocApi.getDocs()
      if (result.success && result.data) {
        tasks.value = result.data
      }
    } catch (err) {
      console.error('[DesignDocStore] 加载任务失败:', err)
    } finally {
      loading.value = false
    }
  }

  /** 加载单个任务 */
  async function loadDoc(id: string) {
    const result = await designDocApi.getDoc(id)
    if (result.success && result.data) {
      currentTask.value = result.data
      // 同步更新 tasks 列表中的对应文档
      const idx = tasks.value.findIndex(d => d.id === id)
      if (idx !== -1) {
        tasks.value[idx] = result.data
      }
      // 同时加载日志
      await loadTaskLogs(id)
    }
    return result.data
  }

  /** 加载任务日志 */
  async function loadTaskLogs(docId: string) {
    const result = await designDocApi.getLogs(docId)
    if (result.success && result.data) {
      currentTaskLogs.value = result.data
    }
  }

  /** 创建任务 */
  async function createTask(data: {
    title: string
    sourceProjectId: string
    sourceProjectTitle: string
    pageCount?: number
  }): Promise<{ task: DesignDoc | null; error?: string }> {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const newTask: DesignDoc = {
      id: `design_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: data.title,
      status: 'pending',
      sourceProjectId: data.sourceProjectId,
      sourceProjectTitle: data.sourceProjectTitle,
      pageCount: data.pageCount || 0,
      createdAt: now,
      updatedAt: now
    }

    try {
      const result = await designDocApi.saveDoc(JSON.parse(JSON.stringify(newTask)))
      if (result.success && result.data) {
        tasks.value.unshift(result.data)
        return { task: result.data }
      }
      return { task: null, error: result.error || '保存文档失败' }
    } catch (err) {
      console.error('[DesignDocStore] 保存异常:', err)
      return { task: null, error: String(err) }
    }
  }

  /** 更新任务 */
  async function updateDoc(task: DesignDoc): Promise<boolean> {
    // 创建纯 JavaScript 对象副本，避免 IPC 克隆错误
    const plainDoc: DesignDoc = {
      id: task.id,
      title: task.title,
      status: task.status,
      sourceProjectId: task.sourceProjectId,
      sourceProjectTitle: task.sourceProjectTitle,
      pageCount: task.pageCount,
      resultContent: task.resultContent,
      createdAt: task.createdAt,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      errorMessage: task.errorMessage,
      progress: task.progress ? { ...task.progress } : undefined
    }

    const result = await designDocApi.saveDoc(JSON.parse(JSON.stringify(plainDoc)))
    if (result.success && result.data) {
      const idx = tasks.value.findIndex(d => d.id === task.id)
      if (idx !== -1) {
        tasks.value[idx] = result.data
      }
      if (currentTask.value?.id === task.id) {
        currentTask.value = result.data
      }
      return true
    }
    return false
  }

  /** 删除任务 */
  async function deleteTask(id: string): Promise<boolean> {
    const result = await designDocApi.deleteDoc(id)
    if (result.success) {
      tasks.value = tasks.value.filter(d => d.id !== id)
      if (currentTask.value?.id === id) {
        currentTask.value = null
      }
      return true
    }
    return false
  }

  /** 启动生成任务 */
  async function startTask(
    docId: string,
    apiKey: string,
    baseUrl: string,
    model?: string,
    prompts?: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> {
    const cleanPrompts = prompts ? JSON.parse(JSON.stringify(prompts)) : undefined
    const result = await designDocApi.start(docId, apiKey, baseUrl, model, cleanPrompts)
    if (result.success) {
      // 刷新文档状态
      await loadDoc(docId)
    }
    return result
  }

  /** 取消生成任务 */
  async function cancelTask(docId: string): Promise<boolean> {
    const result = await designDocApi.cancel(docId)
    if (result.success) {
      await loadDoc(docId)
      return true
    }
    return false
  }

  /** 通过ID获取任务 */
  function getTaskById(id: string): DesignDoc | null {
    return tasks.value.find(d => d.id === id) || null
  }

  // ────────────────────────────────────────────────────────────
  // 计算属性
  // ────────────────────────────────────────────────────────────

  /** 生成中的任务数 */
  const generatingCount = computed(() =>
    tasks.value.filter(d => d.status === 'generating').length
  )

  /** 已完成的任务数 */
  const completedCount = computed(() =>
    tasks.value.filter(d => d.status === 'completed').length
  )

  return {
    tasks,
    currentTask,
    currentTaskLogs,
    loading,
    loadTasks,
    loadDoc,
    loadTaskLogs,
    createTask,
    updateDoc,
    deleteTask,
    startTask,
    cancelTask,
    getTaskById,
    generatingCount,
    completedCount
  }
})
