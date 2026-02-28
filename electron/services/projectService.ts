import { projectRepo } from '../db/repositories/projectRepo'
import { systemRepo } from '../db/repositories/systemRepo'
import { PrototypeProject, GenerateProgress, TaskStatus } from '../../src/electron.d'

export const projectService = {
    getAll(): PrototypeProject[] {
        return projectRepo.getAll()
    },

    getById(id: string): PrototypeProject | undefined {
        return projectRepo.getById(id)
    },

    save(project: PrototypeProject, skipLog: boolean = false): PrototypeProject {
        const saved = projectRepo.save(project)
        if (!skipLog) {
            systemRepo.addLog({
                taskId: project.id,
                type: 'status_change',
                message: `保存原型项目: ${project.id}`,
                detail: `Status: ${project.status}, Pages: ${project.data?.pages?.length || 0}`,
                timestamp: new Date().toISOString()
            })
        }
        return saved
    },

    delete(id: string): boolean {
        const success = projectRepo.delete(id)
        if (success) {
            systemRepo.clearLogsByTaskId(id)
        }
        return success
    },

    updateProgress(id: string, progress: Partial<GenerateProgress>): PrototypeProject | null {
        const project = projectRepo.getById(id)
        if (!project) return null

        project.progress = {
            step: progress.step ?? project.progress?.step ?? 'idle',
            totalPages: progress.totalPages ?? project.progress?.totalPages ?? 0,
            currentPage: progress.currentPage ?? project.progress?.currentPage ?? 0,
            currentPageName: progress.currentPageName ?? project.progress?.currentPageName ?? '',
            completedPages: progress.completedPages ?? project.progress?.completedPages ?? [],
            errorMessage: progress.errorMessage ?? project.progress?.errorMessage,
            lastHeartbeat: progress.lastHeartbeat ?? project.progress?.lastHeartbeat
        }
        project.updatedAt = new Date().toISOString()

        return this.save(project, true)
    },

    updateStatusAndProgress(
        id: string,
        status: TaskStatus,
        progress?: Partial<GenerateProgress>,
        errorMessage?: string
    ): PrototypeProject | null {
        const project = projectRepo.getById(id)
        if (!project) return null

        project.status = status
        project.updatedAt = new Date().toISOString()
        if (errorMessage) project.errorMessage = errorMessage

        if (progress) {
            project.progress = {
                step: progress.step ?? project.progress?.step ?? 'idle',
                totalPages: progress.totalPages ?? project.progress?.totalPages ?? 0,
                currentPage: progress.currentPage ?? project.progress?.currentPage ?? 0,
                currentPageName: progress.currentPageName ?? project.progress?.currentPageName ?? '',
                completedPages: progress.completedPages ?? project.progress?.completedPages ?? [],
                errorMessage: progress.errorMessage ?? project.progress?.errorMessage,
                lastHeartbeat: progress.lastHeartbeat ?? project.progress?.lastHeartbeat
            }
        }

        return this.save(project)
    },

    clearAll(): void {
        projectRepo.clearAll()
        systemRepo.cleanOrphanLogs()
    }
}
