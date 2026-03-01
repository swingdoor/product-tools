import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { marketApi } from '@/api/marketApi'
import type { MarketReport, TaskLog, TaskStatus } from '@/electron.d'

export type { MarketReport, TaskLog, TaskStatus }

export const useMarketInsightStore = defineStore('marketInsight', () => {
  // 任务列表
  const tasks = ref<MarketReport[]>([])
  // 当前任务
  const currentTask = ref<MarketReport | null>(null)
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
      const result = await marketApi.getReports()
      if (result.success && result.data) {
        tasks.value = result.data
      }
    } catch (err) {
      console.error('[MarketStore] 加载任务失败:', err)
    } finally {
      loading.value = false
    }
  }

  /** 加载单个任务 */
  async function loadReport(id: string) {
    const result = await marketApi.getReport(id)
    if (result.success && result.data) {
      currentTask.value = result.data
      // 同步更新 tasks 列表中的对应任务
      const idx = tasks.value.findIndex(r => r.id === id)
      if (idx !== -1) {
        tasks.value[idx] = result.data
      }
      // 同时加载日志
      await loadTaskLogs(id)
    }
    return result.data
  }

  /** 加载任务日志 */
  async function loadTaskLogs(reportId: string) {
    const result = await marketApi.getLogs(reportId)
    if (result.success && result.data) {
      currentTaskLogs.value = result.data
    }
  }

  /** 创建任务 */
  async function createTask(data: {
    title: string
    industry: string
    targetUsers: string
    focusAreas: string[]
    dataSources: string
    deepSearch?: boolean
    knowledgeRefMode?: 'none' | 'auto' | 'manual'
    knowledgeRefDocs?: string[]
  }): Promise<{ task: MarketReport | null; error?: string }> {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const newTask: MarketReport = {
      id: `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: data.title,
      status: 'pending',
      industry: data.industry,
      targetUsers: data.targetUsers,
      focusAreas: [...data.focusAreas],
      dataSources: data.dataSources,
      deepSearch: data.deepSearch,
      knowledgeRefMode: data.knowledgeRefMode || 'none',
      knowledgeRefDocs: data.knowledgeRefDocs || [],
      createdAt: now,
      updatedAt: now
    }

    try {
      const result = await marketApi.saveReport(JSON.parse(JSON.stringify(newTask)))
      if (result.success && result.data) {
        tasks.value.unshift(result.data)
        return { task: result.data }
      }
      return { task: null, error: result.error || '保存任务失败' }
    } catch (err) {
      console.error('[MarketStore] 保存异常:', err)
      return { task: null, error: String(err) }
    }
  }

  /** 更新任务 */
  async function updateReport(report: MarketReport): Promise<boolean> {
    const plainReport: MarketReport = {
      id: report.id,
      title: report.title,
      status: report.status,
      industry: report.industry,
      targetUsers: report.targetUsers,
      focusAreas: [...(report.focusAreas || [])],
      dataSources: report.dataSources,
      deepSearch: report.deepSearch,
      knowledgeRefMode: report.knowledgeRefMode,
      knowledgeRefDocs: report.knowledgeRefDocs,
      resultContent: report.resultContent,
      createdAt: report.createdAt,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      errorMessage: report.errorMessage,
      progress: report.progress ? { ...report.progress } : undefined
    }

    const result = await marketApi.saveReport(JSON.parse(JSON.stringify(plainReport)))
    if (result.success && result.data) {
      const idx = tasks.value.findIndex(r => r.id === report.id)
      if (idx !== -1) {
        tasks.value[idx] = result.data
      }
      if (currentTask.value?.id === report.id) {
        currentTask.value = result.data
      }
      return true
    }
    return false
  }

  /** 删除任务 */
  async function deleteTask(id: string): Promise<boolean> {
    const result = await marketApi.deleteReport(id)
    if (result.success) {
      tasks.value = tasks.value.filter(r => r.id !== id)
      if (currentTask.value?.id === id) {
        currentTask.value = null
      }
      return true
    }
    return false
  }

  /** 启动任务 */
  async function startTask(
    reportId: string,
    searchConfig?: { enabled: boolean }
  ): Promise<{ success: boolean; error?: string }> {
    const cleanSearchConfig = searchConfig ? JSON.parse(JSON.stringify(searchConfig)) : undefined
    const result = await marketApi.start(reportId, cleanSearchConfig)
    if (result.success) {
      await loadReport(reportId)
    }
    return result
  }

  /** 取消任务 */
  async function cancelTask(reportId: string): Promise<boolean> {
    const result = await marketApi.cancel(reportId)
    if (result.success) {
      await loadReport(reportId)
      return true
    }
    return false
  }

  /** 通过ID获取任务 */
  function getTaskById(id: string): MarketReport | null {
    return tasks.value.find(r => r.id === id) || null
  }

  // ────────────────────────────────────────────────────────────
  // 计算属性
  // ────────────────────────────────────────────────────────────

  /** 生成中的任务数 */
  const generatingCount = computed(() =>
    tasks.value.filter(r => r.status === 'generating').length
  )

  /** 已完成的任务数 */
  const completedCount = computed(() =>
    tasks.value.filter(r => r.status === 'completed').length
  )

  return {
    tasks,
    currentTask,
    currentTaskLogs,
    loading,
    generatingCount,
    completedCount,
    loadTasks,
    loadReport,
    loadTaskLogs,
    createTask,
    updateReport,
    deleteTask,
    startTask,
    cancelTask,
    getTaskById
  }
})
