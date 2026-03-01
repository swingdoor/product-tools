import { invokeApi } from './client'
import type { AnalysisTask, TaskLog } from '@/electron.d'

export const analysisApi = {
    getTasks: () => invokeApi<AnalysisTask[]>(() => window.electronAPI.analysisGetTasks()),
    getTask: (id: string) => invokeApi<AnalysisTask | undefined>(() => window.electronAPI.analysisGetTask(id)),
    saveTask: (task: AnalysisTask) => invokeApi<AnalysisTask>(() => window.electronAPI.analysisSaveTask(task)),
    deleteTask: (id: string) => invokeApi<boolean>(() => window.electronAPI.analysisDeleteTask(id)),
    getLogs: (taskId: string) => invokeApi<TaskLog[]>(() => window.electronAPI.analysisGetLogs(taskId)),
    start: (taskId: string) =>
        invokeApi<void>(() => window.electronAPI.analysisStart(taskId)),
    cancel: (taskId: string) => invokeApi<void>(() => window.electronAPI.analysisCancel(taskId)),
}
