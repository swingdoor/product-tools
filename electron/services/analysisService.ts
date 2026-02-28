import { analysisRepo } from '../db/repositories/analysisRepo'
import { systemRepo } from '../db/repositories/systemRepo'
import { AnalysisTask, AnalysisProgress, TaskStatus } from '../../src/electron.d'

export const analysisService = {
    getAll(): AnalysisTask[] {
        return analysisRepo.getAll()
    },

    getById(id: string): AnalysisTask | undefined {
        return analysisRepo.getById(id)
    },

    save(task: AnalysisTask, skipLog: boolean = false): AnalysisTask {
        const saved = analysisRepo.save(task)
        if (!skipLog) {
            systemRepo.addLog({
                taskId: task.id,
                type: 'status_change',
                message: `保存分析任务: ${task.id}`,
                detail: `Status: ${task.status}`,
                timestamp: new Date().toISOString()
            })
        }
        return saved
    },

    delete(id: string): boolean {
        const success = analysisRepo.delete(id)
        if (success) {
            systemRepo.clearLogsByTaskId(id)
        }
        return success
    },

    updateStatus(
        id: string,
        status: TaskStatus,
        updates?: { resultContent?: string; errorMessage?: string; progress?: AnalysisProgress }
    ): AnalysisTask | null {
        const task = analysisRepo.getById(id)
        if (!task) return null

        task.status = status
        task.updatedAt = new Date().toISOString()

        if (updates?.resultContent !== undefined) task.resultContent = updates.resultContent
        if (updates?.errorMessage !== undefined) task.errorMessage = updates.errorMessage
        if (updates?.progress) task.progress = { ...task.progress, ...updates.progress }

        return this.save(task)
    },

    updateHeartbeat(id: string): AnalysisTask | null {
        const task = analysisRepo.getById(id)
        if (!task) return null

        task.progress = {
            ...task.progress,
            lastHeartbeat: new Date().toISOString()
        }
        task.updatedAt = new Date().toISOString()

        return this.save(task, true)
    },

    clearAll(): void {
        analysisRepo.clearAll()
        systemRepo.cleanOrphanLogs()
    }
}
