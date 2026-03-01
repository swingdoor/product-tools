import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { join, dirname } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { marketService } from './services/marketService'
import { analysisService } from './services/analysisService'
import { projectService } from './services/projectService'
import { designDocService } from './services/designDocService'
import { systemRepo } from './db/repositories/systemRepo'
import { dbPath } from './db/connection'
import { logger } from './logger'
import { taskManager } from './services/taskRunner'
import { buildPrompt, AICallParams } from './services/ai'
import { executeMarketTask } from './controllers/market'
import { executeAnalysisTask } from './controllers/analysis'
import { executeGenerateTask } from './controllers/prototype'
import { executeDesignDocTask } from './controllers/design'
import { registerKnowledgeHandlers } from './controllers/knowledge'

export function registerIpcHandlers(mainWindow: BrowserWindow) {
    registerKnowledgeHandlers()
    // ────────────────────────────────────────────────────────────
    // IPC: AI 接口调用
    // ────────────────────────────────────────────────────────────
    ipcMain.handle('ai:call', async (event, params: Omit<AICallParams, 'apiKey' | 'baseUrl' | 'model' | 'systemPrompt'>) => {
        const { type, payload } = params

        const settings = systemRepo.getAppSettings()
        const llmConfig = systemRepo.resolveLlmConfig(settings)

        const apiKey = llmConfig.apiKey
        const baseUrl = llmConfig.baseUrl
        const model = llmConfig.model
        const systemPrompt = settings.prompts[type] || ''
        const prompt = buildPrompt(type as any, payload)
        const messages: any[] = [{ role: 'user', content: prompt }]

        if (systemPrompt && systemPrompt.trim()) {
            messages.unshift({ role: 'system', content: systemPrompt })
        }

        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || 'deepseek-reasoner',
                    messages: messages,
                    stream: true,
                    temperature: 0.7
                })
            })

            if (!response.ok) {
                const errText = await response.text()
                throw new Error(`API请求失败: ${response.status} - ${errText}`)
            }

            const reader = response.body?.getReader()
            const decoder = new TextDecoder('utf-8')
            let fullContent = ''

            if (!reader) throw new Error('无法获取响应流')

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                const lines = chunk.split('\n').filter(line => line.trim())

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') continue
                        try {
                            const parsed = JSON.parse(data)
                            const delta = parsed.choices?.[0]?.delta?.content || ''
                            if (delta) {
                                fullContent += delta
                                event.sender.send('ai:stream-chunk', { chunk: delta, type })
                            }
                        } catch { }
                    }
                }
            }

            event.sender.send('ai:stream-done', { content: fullContent, type })
            return { success: true, content: fullContent }
        } catch (err: any) {
            const message = err instanceof Error ? err.message : '未知错误'
            event.sender.send('ai:stream-error', { error: message, type })
            return { success: false, error: message }
        }
    })

    // ────────────────────────────────────────────────────────────
    // IPC: 文件 & 系统
    // ────────────────────────────────────────────────────────────
    ipcMain.handle('file:save-dialog', async (_event, options: any) => {
        return await dialog.showSaveDialog(mainWindow, {
            title: options.title || '保存文件',
            defaultPath: options.defaultPath || 'export',
            filters: options.filters || [{ name: 'All Files', extensions: ['*'] }]
        })
    })

    ipcMain.handle('file:write', async (_event, { filePath, content }: { filePath: string; content: string }) => {
        try {
            const dir = dirname(filePath)
            if (!existsSync(dir)) await mkdir(dir, { recursive: true })
            await writeFile(filePath, content, 'utf-8')
            return { success: true }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('file:open', async (_event, filePath: string) => {
        await shell.openPath(filePath)
    })

    ipcMain.handle('shell:open-external', async (_event, url: string) => {
        await shell.openExternal(url)
    })

    // ────────────────────────────────────────────────────────────
    // IPC: 数据库操作 (Projects)
    // ────────────────────────────────────────────────────────────
    ipcMain.handle('db:get-projects', async () => ({ success: true, data: projectService.getAll() }))
    ipcMain.handle('db:get-project', async (_event, id: string) => ({ success: true, data: projectService.getById(id) }))
    ipcMain.handle('db:save-project', async (_event, project: any) => ({ success: true, data: projectService.save(project) }))
    ipcMain.handle('db:delete-project', async (_event, id: string) => ({ success: true, data: projectService.delete(id) }))
    ipcMain.handle('db:get-logs', async (_event, taskId: string) => ({ success: true, data: systemRepo.getLogsByTaskId(taskId) }))
    ipcMain.handle('db:get-all-logs', async () => ({ success: true, data: systemRepo.getLogs() }))
    ipcMain.handle('db:add-log', async (_event, log: any) => ({ success: true, data: systemRepo.addLog(log) }))
    ipcMain.handle('db:update-progress', async (_event, { id, progress }: any) => ({ success: true, data: projectService.updateProgress(id, progress) }))

    // ────────────────────────────────────────────────────────────
    // IPC: 需求分析 (Analysis)
    // ────────────────────────────────────────────────────────────
    ipcMain.handle('analysis:get-tasks', async () => ({ success: true, data: analysisService.getAll() }))
    ipcMain.handle('analysis:get-task', async (_event, id: string) => ({ success: true, data: analysisService.getById(id) }))
    ipcMain.handle('analysis:save-task', async (_event, task: any) => ({ success: true, data: analysisService.save(task) }))
    ipcMain.handle('analysis:delete-task', async (_event, id: string) => {
        taskManager.cancelTask(id)
        return { success: true, data: analysisService.delete(id) }
    })
    ipcMain.handle('analysis:get-logs', async (_event, taskId: string) => ({ success: true, data: systemRepo.getLogsByTaskId(taskId) }))
    ipcMain.handle('analysis:start', async (_event, { taskId }) => {
        if (taskManager.isTaskRunning(taskId)) return { success: false, error: '任务已在运行中' }
        const task = analysisService.getById(taskId)
        if (!task) return { success: false, error: '任务不存在' }
        if (!task.inputContent?.trim()) return { success: false, error: '分析内容为空' }

        const taskState = taskManager.registerTask(taskId)
        analysisService.updateStatus(taskId, 'generating', { progress: { lastHeartbeat: new Date().toISOString() } })
        systemRepo.addLog({ taskId, type: 'generate_start', message: '开始分析', timestamp: new Date().toISOString() })

        const settings = systemRepo.getAppSettings()
        const { apiKey, baseUrl, model } = systemRepo.resolveLlmConfig(settings)

        executeAnalysisTask(taskId, task.inputContent, apiKey, baseUrl, model, taskState, settings.prompts)
            .catch(e => logger.error('IPC', `分析任务执行出错: ${e.message}`, taskId))
            .finally(() => taskManager.unregisterTask(taskId))
        return { success: true }
    })
    ipcMain.handle('analysis:cancel', async (_event, taskId: string) => {
        if (taskManager.cancelTask(taskId)) {
            analysisService.updateStatus(taskId, 'pending')
            systemRepo.addLog({ taskId, type: 'status_change', message: '用户取消分析', timestamp: new Date().toISOString() })
            return { success: true }
        }
        return { success: false, error: '任务不存在或已完成' }
    })

    // ────────────────────────────────────────────────────────────
    // IPC: 市场洞察 (Market)
    // ────────────────────────────────────────────────────────────
    ipcMain.handle('market:get-reports', async () => ({ success: true, data: marketService.getAll() }))
    ipcMain.handle('market:get-report', async (_event, id: string) => ({ success: true, data: marketService.getById(id) }))
    ipcMain.handle('market:save-report', async (_event, report: any) => ({ success: true, data: marketService.save(report) }))
    ipcMain.handle('market:delete-report', async (_event, id: string) => ({ success: true, data: marketService.delete(id) }))
    ipcMain.handle('market:get-logs', async (_event, taskId: string) => ({ success: true, data: systemRepo.getLogsByTaskId(taskId) }))
    ipcMain.handle('market:start', async (_event, { reportId, searchConfig }) => {
        logger.info('IPC', '收到 market:start 请求', `reportId: ${reportId}`)
        if (taskManager.isTaskRunning(reportId)) return { success: false, error: '任务已在运行中' }
        const report = marketService.getById(reportId)
        if (!report || !report.industry?.trim()) return { success: false, error: '报告不存在或行业为空' }

        const taskState = taskManager.registerTask(reportId)
        marketService.updateStatus(reportId, 'generating', { progress: { lastHeartbeat: new Date().toISOString() } })
        systemRepo.addLog({ taskId: reportId, type: 'generate_start', message: '开始生成市场报告', timestamp: new Date().toISOString() })

        const settings = systemRepo.getAppSettings()
        const { apiKey, baseUrl, model } = systemRepo.resolveLlmConfig(settings)

        executeMarketTask(reportId, report, apiKey, baseUrl, model, taskState, settings.prompts, searchConfig)
            .catch(e => logger.error('IPC', `市场报告任务执行出错: ${e.message}`, reportId))
            .finally(() => {
                logger.info('IPC', `市场报告任务结束 | ID: ${reportId}`)
                taskManager.unregisterTask(reportId)
            })
        return { success: true }
    })
    ipcMain.handle('market:cancel', async (_event, reportId: string) => {
        if (taskManager.cancelTask(reportId)) {
            marketService.updateStatus(reportId, 'pending')
            systemRepo.addLog({ taskId: reportId, type: 'status_change', message: '用户取消生成', timestamp: new Date().toISOString() })
            return { success: true }
        }
        return { success: false, error: '任务不存在或已完成' }
    })

    // ────────────────────────────────────────────────────────────
    // IPC: 设计文档 (Design)
    // ────────────────────────────────────────────────────────────
    ipcMain.handle('design:get-docs', async () => ({ success: true, data: designDocService.getAll() }))
    ipcMain.handle('design:get-doc', async (_event, id: string) => ({ success: true, data: designDocService.getById(id) }))
    ipcMain.handle('design:save-doc', async (_event, doc: any) => ({ success: true, data: designDocService.save(doc) }))
    ipcMain.handle('design:delete-doc', async (_event, id: string) => ({ success: true, data: designDocService.delete(id) }))
    ipcMain.handle('design:get-logs', async (_event, docId: string) => ({ success: true, data: systemRepo.getLogsByTaskId(docId) }))
    ipcMain.handle('design:start', async (_event, { docId }) => {
        if (taskManager.isTaskRunning(docId)) return { success: false, error: '任务已在运行中' }
        const doc = designDocService.getById(docId)
        const project = doc ? projectService.getById(doc.sourceProjectId) : null
        if (!doc || !project || !project.data?.pages?.length) return { success: false, error: '文档或项目数据不完整' }

        const taskState = taskManager.registerTask(docId)
        designDocService.updateStatus(docId, 'generating', {
            progress: {
                totalPages: project.data.pages.length,
                currentPage: 0,
                currentPageName: '',
                percentage: 0,
                lastHeartbeat: new Date().toISOString()
            }
        })
        systemRepo.addLog({ taskId: docId, type: 'generate_start', message: '开始生成设计文档', timestamp: new Date().toISOString() })

        const settings = systemRepo.getAppSettings()
        const { apiKey, baseUrl, model } = systemRepo.resolveLlmConfig(settings)

        executeDesignDocTask(docId, doc, project, apiKey, baseUrl, model, taskState, settings.prompts)
            .catch(e => logger.error('IPC', `设计文档任务执行出错: ${e.message}`, docId))
            .finally(() => taskManager.unregisterTask(docId))
        return { success: true }
    })
    ipcMain.handle('design:cancel', async (_event, docId: string) => {
        if (taskManager.cancelTask(docId)) {
            designDocService.updateStatus(docId, 'pending', { progress: { totalPages: 0, currentPage: 0, currentPageName: '', percentage: 0 } })
            systemRepo.addLog({ taskId: docId, type: 'status_change', message: '用户取消生成', timestamp: new Date().toISOString() })
            return { success: true }
        }
        return { success: false, error: '任务不存在或已完成' }
    })

    // ────────────────────────────────────────────────────────────
    // IPC: 原型生成 (Prototype Task Case)
    // ────────────────────────────────────────────────────────────
    ipcMain.handle('task:start-generate', async (_event, { projectId }) => {
        if (taskManager.isTaskRunning(projectId)) return { success: false, error: '任务已在运行中' }
        const project = projectService.getById(projectId)
        if (!project || !project.analysisContent?.trim()) return { success: false, error: '项目或分析内容为空' }

        const taskState = taskManager.registerTask(projectId)
        projectService.updateStatusAndProgress(projectId, 'generating', {
            step: 'plan',
            totalPages: 0,
            currentPage: 0,
            currentPageName: '',
            completedPages: [],
            lastHeartbeat: new Date().toISOString()
        })
        systemRepo.addLog({ taskId: projectId, type: 'generate_start', message: '开始生成原型', timestamp: new Date().toISOString() })

        const settings = systemRepo.getAppSettings()
        const { apiKey, baseUrl, model } = systemRepo.resolveLlmConfig(settings)

        executeGenerateTask(projectId, project.analysisContent, project.clientType || 'Web端', apiKey, baseUrl, model, taskState, settings.prompts)
            .catch(e => logger.error('IPC', `生成原型任务执行出错: ${e.message}`, projectId))
            .finally(() => {
                logger.info('IPC', `生成原型任务结束 | ID: ${projectId}`)
                taskManager.unregisterTask(projectId)
            })
        return { success: true }
    })

    ipcMain.handle('task:cancel', async (_event, projectId: string) => {
        if (taskManager.cancelTask(projectId)) {
            projectService.updateStatusAndProgress(projectId, 'pending', { step: 'idle' })
            systemRepo.addLog({ taskId: projectId, type: 'status_change', message: '用户取消生成', timestamp: new Date().toISOString() })
            return { success: true }
        }
        return { success: false, error: '任务不存在或已完成' }
    })

    // ────────────────────────────────────────────────────────────
    // IPC: 数据清除
    // ────────────────────────────────────────────────────────────
    ipcMain.handle('data:clear-market', async () => { marketService.clearAll(); return { success: true } })
    ipcMain.handle('data:clear-analysis', async () => { analysisService.clearAll(); return { success: true } })
    ipcMain.handle('data:clear-prototype', async () => { projectService.clearAll(); return { success: true } })
    ipcMain.handle('data:clear-design', async () => { designDocService.clearAll(); return { success: true } })

    // ────────────────────────────────────────────────────────────
    // IPC: 应用配置
    // ────────────────────────────────────────────────────────────
    ipcMain.handle('app:get-config-path', async () => {
        return { success: true, data: dbPath }
    })
    ipcMain.handle('app:open-config-folder', async () => {
        await shell.showItemInFolder(dbPath)
        return { success: true }
    })

    // ────────────────────────────────────────────────────────────
    // IPC: 应用配置 (config.json)
    // ────────────────────────────────────────────────────────────
    ipcMain.handle('config:get', async () => ({ success: true, data: systemRepo.getAppSettings() }))
    ipcMain.handle('config:save', async (_event, settings) => {
        systemRepo.saveAppSettings(settings)
        return { success: true }
    })
    ipcMain.handle('config:get-path', async () => {
        return { success: true, data: dbPath }
    })
}
