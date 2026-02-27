import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AnalysisTask, TaskLog, TaskStatus } from '@/electron.d'

export type { AnalysisTask, TaskLog, TaskStatus }

export const useProductAnalysisStore = defineStore('productAnalysis', () => {
  // 任务列表
  const tasks = ref<AnalysisTask[]>([])
  // 当前任务
  const currentTask = ref<AnalysisTask | null>(null)
  // 当前任务日志
  const taskLogs = ref<TaskLog[]>([])
  // 加载状态
  const loading = ref(false)

  // ────────────────────────────────────────────────────────────
  // 数据库操作方法
  // ────────────────────────────────────────────────────────────

  /** 加载所有任务 */
  async function loadTasks() {
    loading.value = true
    try {
      const result = await window.electronAPI.analysisGetTasks()
      if (result.success && result.data) {
        tasks.value = result.data
      }
    } finally {
      loading.value = false
    }
  }

  /** 加载单个任务 */
  async function loadTask(id: string) {
    const result = await window.electronAPI.analysisGetTask(id)
    if (result.success && result.data) {
      currentTask.value = result.data
      // 同步更新 tasks 列表中的对应任务
      const idx = tasks.value.findIndex(t => t.id === id)
      if (idx !== -1) {
        tasks.value[idx] = result.data
      }
      // 同时加载日志
      await loadTaskLogs(id)
    }
    return result.data
  }

  /** 加载任务日志 */
  async function loadTaskLogs(taskId: string) {
    const result = await window.electronAPI.analysisGetLogs(taskId)
    if (result.success && result.data) {
      taskLogs.value = result.data
    }
  }

  /** 创建任务 */
  async function createTask(data: {
    title: string
    sourceReportId?: string
    sourceReportTitle?: string
    inputContent: string
  }): Promise<AnalysisTask | null> {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const newTask: AnalysisTask = {
      id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: data.title,
      status: 'pending',
      sourceReportId: data.sourceReportId,
      sourceReportTitle: data.sourceReportTitle,
      inputContent: data.inputContent,
      createdAt: now,
      updatedAt: now
    }

    const result = await window.electronAPI.analysisSaveTask(newTask)
    if (result.success && result.data) {
      tasks.value.unshift(result.data)
      return result.data
    }
    return null
  }

  /** 更新任务 */
  async function updateTask(task: AnalysisTask): Promise<boolean> {
    task.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const result = await window.electronAPI.analysisSaveTask(task)
    if (result.success && result.data) {
      const idx = tasks.value.findIndex(t => t.id === task.id)
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
    const result = await window.electronAPI.analysisDeleteTask(id)
    if (result.success) {
      tasks.value = tasks.value.filter(t => t.id !== id)
      if (currentTask.value?.id === id) {
        currentTask.value = null
      }
      return true
    }
    return false
  }

  /** 启动分析任务 */
  async function startAnalysis(
    taskId: string,
    apiKey: string,
    baseUrl: string,
    model?: string
  ): Promise<{ success: boolean; error?: string }> {
    const result = await window.electronAPI.analysisStart(taskId, apiKey, baseUrl, model)
    if (result.success) {
      // 刷新任务状态
      await loadTask(taskId)
    }
    return result
  }

  /** 取消分析任务 */
  async function cancelAnalysis(taskId: string): Promise<boolean> {
    const result = await window.electronAPI.analysisCancel(taskId)
    if (result.success) {
      await loadTask(taskId)
      return true
    }
    return false
  }

  // ────────────────────────────────────────────────────────────
  // 计算属性
  // ────────────────────────────────────────────────────────────

  /** 生成中的任务数 */
  const generatingCount = computed(() => 
    tasks.value.filter(t => t.status === 'generating').length
  )

  /** 已完成的任务数 */
  const completedCount = computed(() => 
    tasks.value.filter(t => t.status === 'completed').length
  )

  return {
    tasks,
    currentTask,
    taskLogs,
    loading,
    loadTasks,
    loadTask,
    loadTaskLogs,
    createTask,
    updateTask,
    deleteTask,
    startAnalysis,
    cancelAnalysis,
    generatingCount,
    completedCount
  }
})
