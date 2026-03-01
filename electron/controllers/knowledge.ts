import { ipcMain, dialog, BrowserWindow } from 'electron'
import { knowledgeService } from '../services/knowledgeService'
import { knowledgeRepo } from '../db/repositories/knowledgeRepo'
import { logger } from '../logger'
import fs from 'fs'
import path from 'path'

export function registerKnowledgeHandlers() {
    // 打开文件选择对话框
    ipcMain.handle('knowledge:selectFile', async () => {
        try {
            const result = await dialog.showOpenDialog({
                title: '选择文档',
                filters: [
                    { name: '文档', extensions: ['pdf', 'doc', 'docx', 'md', 'txt'] }
                ],
                properties: ['openFile']
            })
            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, error: 'cancelled' }
            }
            const filePath = result.filePaths[0]
            const stats = fs.statSync(filePath)
            const filename = path.basename(filePath)
            const ext = path.extname(filename).slice(1).toLowerCase()
            return {
                success: true,
                data: {
                    sourcePath: filePath,
                    filename,
                    type: ext,
                    size: stats.size
                }
            }
        } catch (e: any) {
            logger.error('Knowledge', '选择文件失败', e.message)
            return { success: false, error: e.message }
        }
    })

    ipcMain.handle('knowledge:getList', () => {
        try {
            return { success: true, data: knowledgeService.getDocuments() }
        } catch (e: any) {
            logger.error('Knowledge', '获取文档列表失败', e.message)
            return { success: false, error: e.message }
        }
    })

    ipcMain.handle('knowledge:upload', async (event, params: {
        sourcePath: string
        filename: string
        type: string
        size: number
        embeddingConfig: { apiKey: string; baseUrl: string; model: string }
    }) => {
        try {
            const doc = await knowledgeService.uploadDocument(
                params.sourcePath,
                params.filename,
                params.type,
                params.size,
                params.embeddingConfig
            )
            return { success: true, data: doc }
        } catch (e: any) {
            logger.error('Knowledge', '上传并处理文档失败', e.message)
            return { success: false, error: e.message }
        }
    })

    ipcMain.handle('knowledge:delete', (event, docId: string) => {
        try {
            knowledgeService.deleteDocument(docId)
            return { success: true }
        } catch (e: any) {
            logger.error('Knowledge', '删除文档失败', e.message)
            return { success: false, error: e.message }
        }
    })

    ipcMain.handle('knowledge:preview', async (event, docId: string) => {
        try {
            const data = await knowledgeService.previewDocument(docId)
            return { success: true, data }
        } catch (e: any) {
            logger.error('Knowledge', '预览文档失败', e.message)
            return { success: false, error: e.message }
        }
    })

    ipcMain.handle('knowledge:searchSemantic', async (event, params: {
        query: string
        type: 'semantic' | 'keyword'
        embeddingConfig?: { apiKey: string; baseUrl: string; model: string }
    }) => {
        try {
            const results = await knowledgeService.searchDocuments(params.query, params.type, params.embeddingConfig)
            if (params.type === 'keyword') {
                return { success: true, data: { docs: results, chunks: [] } }
            }
            return { success: true, data: results }
        } catch (e: any) {
            logger.error('Knowledge', '检索文档失败', e.message)
            return { success: false, error: e.message }
        }
    })

    ipcMain.handle('knowledge:updateTags', (event, params: { docId: string; tags: string[] }) => {
        try {
            knowledgeService.updateTags(params.docId, params.tags)
            return { success: true }
        } catch (e: any) {
            logger.error('Knowledge', '更新标签失败', e.message)
            return { success: false, error: e.message }
        }
    })

    // 在新窗口中打开 PDF（使用 Chromium 内置 PDF 查看器）
    ipcMain.handle('knowledge:openPdfWindow', (event, filePath: string) => {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: '文件不存在' }
            }
            const pdfWindow = new BrowserWindow({
                width: 1000,
                height: 800,
                title: path.basename(filePath),
                webPreferences: {
                    plugins: true
                }
            })
            // 使用自定义协议 knowledge-file://local/{filename} 访问
            // 注意：这里需要传入数据库中的相对路径（即文件名）
            const filename = path.basename(filePath)
            const fileUrl = `knowledge-file://local/${encodeURIComponent(filename)}`
            pdfWindow.loadURL(fileUrl)
            return { success: true }
        } catch (e: any) {
            logger.error('Knowledge', '打开PDF窗口失败', e.message)
            return { success: false, error: e.message }
        }
    })
}
