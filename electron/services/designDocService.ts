import { designDocRepo } from '../db/repositories/designDocRepo'
import { systemRepo } from '../db/repositories/systemRepo'
import { DesignDoc, DesignDocProgress, TaskStatus } from '../../src/electron.d'

export const designDocService = {
    getAll(): DesignDoc[] {
        return designDocRepo.getAll()
    },

    getById(id: string): DesignDoc | undefined {
        return designDocRepo.getById(id)
    },

    save(doc: DesignDoc, skipLog: boolean = false): DesignDoc {
        const saved = designDocRepo.save(doc)
        if (!skipLog) {
            systemRepo.addLog({
                taskId: doc.id,
                type: 'status_change',
                message: `保存设计文档: ${doc.id}`,
                detail: `Status: ${doc.status}, Pages: ${doc.pageCount}`,
                timestamp: new Date().toISOString()
            })
        }
        return saved
    },

    delete(id: string): boolean {
        const success = designDocRepo.delete(id)
        if (success) {
            systemRepo.clearLogsByTaskId(id)
        }
        return success
    },

    updateStatus(
        id: string,
        status: TaskStatus,
        updates?: { resultContent?: string; errorMessage?: string; progress?: Partial<DesignDocProgress> }
    ): DesignDoc | null {
        const doc = designDocRepo.getById(id)
        if (!doc) return null

        doc.status = status
        doc.updatedAt = new Date().toISOString()

        if (updates?.resultContent !== undefined) doc.resultContent = updates.resultContent
        if (updates?.errorMessage !== undefined) doc.errorMessage = updates.errorMessage
        if (updates?.progress) {
            doc.progress = {
                totalPages: updates.progress.totalPages ?? doc.progress?.totalPages ?? 0,
                currentPage: updates.progress.currentPage ?? doc.progress?.currentPage ?? 0,
                currentPageName: updates.progress.currentPageName ?? doc.progress?.currentPageName ?? '',
                percentage: updates.progress.percentage ?? doc.progress?.percentage ?? 0,
                lastHeartbeat: updates.progress.lastHeartbeat ?? doc.progress?.lastHeartbeat
            }
        }

        return this.save(doc)
    },

    updateProgress(
        id: string,
        progress: Partial<DesignDocProgress>
    ): DesignDoc | null {
        const doc = designDocRepo.getById(id)
        if (!doc) return null

        doc.progress = {
            totalPages: progress.totalPages ?? doc.progress?.totalPages ?? 0,
            currentPage: progress.currentPage ?? doc.progress?.currentPage ?? 0,
            currentPageName: progress.currentPageName ?? doc.progress?.currentPageName ?? '',
            percentage: progress.percentage ?? doc.progress?.percentage ?? 0,
            lastHeartbeat: progress.lastHeartbeat ?? new Date().toISOString()
        }
        doc.updatedAt = new Date().toISOString()

        return this.save(doc, true) // skip logging for progress heartbeats
    },

    clearAll(): void {
        designDocRepo.clearAll()
        systemRepo.cleanOrphanLogs()
    }
}
