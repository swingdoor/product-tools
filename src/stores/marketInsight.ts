import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MarketReport, TaskLog, TaskStatus } from '@/electron.d'

export type { MarketReport, TaskLog, TaskStatus }

export const useMarketInsightStore = defineStore('marketInsight', () => {
  // 报告列表
  const reports = ref<MarketReport[]>([])
  // 当前报告
  const currentReport = ref<MarketReport | null>(null)
  // 当前报告日志
  const reportLogs = ref<TaskLog[]>([])
  // 加载状态
  const loading = ref(false)

  // ────────────────────────────────────────────────────────────
  // 数据库操作方法
  // ────────────────────────────────────────────────────────────

  /** 加载所有报告 */
  async function loadReports() {
    loading.value = true
    try {
      const result = await window.electronAPI.marketGetReports()
      if (result.success && result.data) {
        reports.value = result.data
      }
    } finally {
      loading.value = false
    }
  }

  /** 加载单个报告 */
  async function loadReport(id: string) {
    const result = await window.electronAPI.marketGetReport(id)
    if (result.success && result.data) {
      currentReport.value = result.data
      // 同步更新 reports 列表中的对应报告
      const idx = reports.value.findIndex(r => r.id === id)
      if (idx !== -1) {
        reports.value[idx] = result.data
      }
      // 同时加载日志
      await loadReportLogs(id)
    }
    return result.data
  }

  /** 加载报告日志 */
  async function loadReportLogs(reportId: string) {
    const result = await window.electronAPI.marketGetLogs(reportId)
    if (result.success && result.data) {
      reportLogs.value = result.data
    }
  }

  /** 创建报告 */
  async function createReport(data: {
    title: string
    industry: string
    targetUsers: string
    focusAreas: string[]
    dataSources: string
  }): Promise<{ report: MarketReport | null; error?: string }> {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    
    // 注意：必须创建纯 JavaScript 对象，避免 Vue reactive 对象无法通过 IPC 克隆
    const newReport: MarketReport = {
      id: `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: data.title,
      status: 'pending',
      industry: data.industry,
      targetUsers: data.targetUsers,
      focusAreas: [...data.focusAreas], // 创建数组副本
      dataSources: data.dataSources,
      createdAt: now,
      updatedAt: now
    }

    try {
      console.log('[MarketStore] 保存报告:', newReport)
      const result = await window.electronAPI.marketSaveReport(newReport)
      console.log('[MarketStore] 保存结果:', result)
      if (result.success && result.data) {
        reports.value.unshift(result.data)
        return { report: result.data }
      }
      return { report: null, error: result.error || '保存报告失败' }
    } catch (err) {
      console.error('[MarketStore] 保存异常:', err)
      return { report: null, error: String(err) }
    }
  }

  /** 更新报告 */
  async function updateReport(report: MarketReport): Promise<boolean> {
    // 创建纯 JavaScript 对象副本，避免 IPC 克隆错误
    const plainReport: MarketReport = {
      id: report.id,
      title: report.title,
      status: report.status,
      industry: report.industry,
      targetUsers: report.targetUsers,
      focusAreas: [...(report.focusAreas || [])],
      dataSources: report.dataSources,
      resultContent: report.resultContent,
      createdAt: report.createdAt,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      errorMessage: report.errorMessage,
      progress: report.progress ? { ...report.progress } : undefined
    }
    
    const result = await window.electronAPI.marketSaveReport(plainReport)
    if (result.success && result.data) {
      const idx = reports.value.findIndex(r => r.id === report.id)
      if (idx !== -1) {
        reports.value[idx] = result.data
      }
      if (currentReport.value?.id === report.id) {
        currentReport.value = result.data
      }
      return true
    }
    return false
  }

  /** 删除报告 */
  async function deleteReport(id: string): Promise<boolean> {
    const result = await window.electronAPI.marketDeleteReport(id)
    if (result.success) {
      reports.value = reports.value.filter(r => r.id !== id)
      if (currentReport.value?.id === id) {
        currentReport.value = null
      }
      return true
    }
    return false
  }

  /** 启动报告生成任务 */
  async function startGenerate(
    reportId: string,
    apiKey: string,
    baseUrl: string,
    model?: string
  ): Promise<{ success: boolean; error?: string }> {
    const result = await window.electronAPI.marketStart(reportId, apiKey, baseUrl, model)
    if (result.success) {
      // 刷新报告状态
      await loadReport(reportId)
    }
    return result
  }

  /** 取消报告生成任务 */
  async function cancelGenerate(reportId: string): Promise<boolean> {
    const result = await window.electronAPI.marketCancel(reportId)
    if (result.success) {
      await loadReport(reportId)
      return true
    }
    return false
  }

  /** 通过ID获取报告 */
  function getReportById(id: string): MarketReport | null {
    return reports.value.find(r => r.id === id) || null
  }

  // ────────────────────────────────────────────────────────────
  // 计算属性
  // ────────────────────────────────────────────────────────────

  /** 生成中的报告数 */
  const generatingCount = computed(() => 
    reports.value.filter(r => r.status === 'generating').length
  )

  /** 已完成的报告数 */
  const completedCount = computed(() => 
    reports.value.filter(r => r.status === 'completed').length
  )

  return {
    reports,
    currentReport,
    reportLogs,
    loading,
    loadReports,
    loadReport,
    loadReportLogs,
    createReport,
    updateReport,
    deleteReport,
    startGenerate,
    cancelGenerate,
    getReportById,
    generatingCount,
    completedCount
  }
})
