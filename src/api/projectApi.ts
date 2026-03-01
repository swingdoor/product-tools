import { invokeApi } from './client'
import type { PrototypeProject, TaskLog, TaskLogInput, GenerateProgress, TaskStatus } from '@/electron.d'

export const projectApi = {
    getProjects: () => invokeApi<PrototypeProject[]>(() => window.electronAPI.dbGetProjects()),
    getProject: (id: string) => invokeApi<PrototypeProject | undefined>(() => window.electronAPI.dbGetProject(id)),
    saveProject: (project: PrototypeProject) => invokeApi<PrototypeProject>(() => window.electronAPI.dbSaveProject(project)),
    deleteProject: (id: string) => invokeApi<boolean>(() => window.electronAPI.dbDeleteProject(id)),
    getLogs: (taskId: string) => invokeApi<TaskLog[]>(() => window.electronAPI.dbGetLogs(taskId)),
    addLog: (log: TaskLogInput) => invokeApi<TaskLog>(() => window.electronAPI.dbAddLog(log)),
    startGenerate: (projectId: string) =>
        invokeApi<void>(() => window.electronAPI.taskStartGenerate(projectId)),
    cancelGenerate: (projectId: string) => invokeApi<void>(() => window.electronAPI.taskCancel(projectId)),
    updateProgress: (id: string, progress: Partial<GenerateProgress>) => invokeApi<PrototypeProject>(() => window.electronAPI.dbUpdateProgress(id, progress)),
    updateStatusProgress: (id: string, status: TaskStatus, progress?: Partial<GenerateProgress>, errorMessage?: string) =>
        invokeApi<PrototypeProject>(() => window.electronAPI.dbUpdateStatusProgress(id, status, progress, errorMessage)),
}
