import { invokeApi } from './client'
import type { MarketReport, TaskLog } from '@/electron.d'

export const marketApi = {
    getReports: () => invokeApi<MarketReport[]>(() => window.electronAPI.marketGetReports()),
    getReport: (id: string) => invokeApi<MarketReport | undefined>(() => window.electronAPI.marketGetReport(id)),
    saveReport: (report: MarketReport) => invokeApi<MarketReport>(() => window.electronAPI.marketSaveReport(report)),
    deleteReport: (id: string) => invokeApi<boolean>(() => window.electronAPI.marketDeleteReport(id)),
    getLogs: (taskId: string) => invokeApi<TaskLog[]>(() => window.electronAPI.marketGetLogs(taskId)),
    start: (reportId: string, searchConfig?: { enabled: boolean }) =>
        invokeApi<void>(() => window.electronAPI.marketStart(reportId, searchConfig)),
    cancel: (reportId: string) => invokeApi<void>(() => window.electronAPI.marketCancel(reportId)),
}
