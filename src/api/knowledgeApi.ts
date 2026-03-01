import { invokeApi } from './client'

export const knowledgeApi = {
    selectFile: () => invokeApi<{ sourcePath: string; filename: string; type: string; size: number }>(() => window.electronAPI.knowledgeSelectFile()),
    getList: () => invokeApi<any[]>(() => window.electronAPI.knowledgeGetList()),
    upload: (params: {
        sourcePath: string
        filename: string
        type: string
        size: number
        embeddingConfig: { apiKey: string; baseUrl: string; model: string }
    }) => invokeApi<any>(() => window.electronAPI.knowledgeUpload(params)),
    delete: (docId: string) => invokeApi<void>(() => window.electronAPI.knowledgeDelete(docId)),
    preview: (docId: string) => invokeApi<{ doc: any; text: string; html: string; ext: string }>(() => window.electronAPI.knowledgePreview(docId)),
    searchSemantic: (params: {
        query: string
        type: 'semantic' | 'keyword'
        embeddingConfig?: { apiKey: string; baseUrl: string; model: string }
    }) => invokeApi<any>(() => window.electronAPI.knowledgeSearchSemantic(params)),
    updateTags: (params: { docId: string; tags: string[] }) => invokeApi<void>(() => window.electronAPI.knowledgeUpdateTags(params)),
    openPdfWindow: (filePath: string) => invokeApi<void>(() => window.electronAPI.knowledgeOpenPdfWindow(filePath)),
}
