import { marketRepo } from '../db/repositories/marketRepo'
import { systemRepo } from '../db/repositories/systemRepo'
import { MarketReport, MarketProgress, TaskStatus } from '../../src/electron.d'

export const marketService = {
    getAll(): MarketReport[] {
        return marketRepo.getAll()
    },

    getById(id: string): MarketReport | undefined {
        return marketRepo.getById(id)
    },

    save(report: MarketReport, skipLog: boolean = false): MarketReport {
        const saved = marketRepo.save(report)
        if (!skipLog) {
            systemRepo.addLog({
                taskId: report.id,
                type: 'status_change',
                message: `保存市场报告: ${report.id}`,
                detail: `Status: ${report.status}, ContentLen: ${report.resultContent?.length || 0}`,
                timestamp: new Date().toISOString()
            })
        }
        return saved
    },

    delete(id: string): boolean {
        const success = marketRepo.delete(id)
        if (success) {
            systemRepo.clearLogsByTaskId(id)
        }
        return success
    },

    updateStatus(
        id: string,
        status: TaskStatus,
        updates?: { resultContent?: string; errorMessage?: string; progress?: MarketProgress }
    ): MarketReport | null {
        const report = marketRepo.getById(id)
        if (!report) return null

        report.status = status
        report.updatedAt = new Date().toISOString()

        if (updates?.resultContent !== undefined) report.resultContent = updates.resultContent
        if (updates?.errorMessage !== undefined) report.errorMessage = updates.errorMessage
        if (updates?.progress) report.progress = { ...report.progress, ...updates.progress }

        return this.save(report)
    },

    updateHeartbeat(id: string): MarketReport | null {
        const report = marketRepo.getById(id)
        if (!report) return null

        report.progress = {
            ...report.progress,
            lastHeartbeat: new Date().toISOString()
        }
        report.updatedAt = new Date().toISOString()

        return this.save(report, true)
    },

    clearAll(): void {
        marketRepo.clearAll()
        systemRepo.cleanOrphanLogs()
    }
}
