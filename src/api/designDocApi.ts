import { invokeApi } from './client'
import type { DesignDoc, TaskLog } from '@/electron.d'

export const designDocApi = {
    getDocs: () => invokeApi<DesignDoc[]>(() => window.electronAPI.designGetDocs()),
    getDoc: (id: string) => invokeApi<DesignDoc | undefined>(() => window.electronAPI.designGetDoc(id)),
    saveDoc: (doc: DesignDoc) => invokeApi<DesignDoc>(() => window.electronAPI.designSaveDoc(doc)),
    deleteDoc: (id: string) => invokeApi<boolean>(() => window.electronAPI.designDeleteDoc(id)),
    getLogs: (taskId: string) => invokeApi<TaskLog[]>(() => window.electronAPI.designGetLogs(taskId)),
    start: (docId: string) =>
        invokeApi<void>(() => window.electronAPI.designStart(docId)),
    cancel: (docId: string) => invokeApi<void>(() => window.electronAPI.designCancel(docId)),
}
