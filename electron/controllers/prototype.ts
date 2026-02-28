import { getProjectById, saveProject, updateProjectStatusAndProgress, updateProjectProgress, addLog } from '../store'
import { TaskState, HEARTBEAT_INTERVAL_MS } from '../services/taskRunner'
import { buildPrompt, getCanvasInfoByClientType, AIType } from '../services/ai'
import { logger } from '../logger'

/** 执行生成任务 */
export async function executeGenerateTask(
    projectId: string,
    analysisContent: string,
    clientType: string,
    apiKey: string,
    baseUrl: string,
    model: string | undefined,
    taskState: TaskState,
    prompts?: Record<string, string>
) {
    const moduleName = 'PrototypeGen'
    logger.info(moduleName, `开始执行生成任务 | ID: ${projectId}`)
    try {
        // 第一步：规划页面
        addLog({ taskId: projectId, type: 'generate_step', message: '步骤1：正在规划页面架构...', timestamp: new Date().toISOString() })
        const planRaw = await callAIWithHeartbeat(
            'prototype-plan',
            { analysisContent, clientType },
            apiKey, baseUrl, model,
            projectId, taskState,
            prompts?.['prototype-plan']
        )

        if (taskState.cancelled) return

        // 解析规划结果
        const planData = parseJSON<{ appName: string; clientType: string; pages: { id: string; name: string; description: string }[] }>(planRaw)
        if (!planData?.pages?.length) throw new Error('页面规划解析失败，请重试')

        const { appName, pages: plannedPages } = planData

        // 更新进度
        updateProjectProgress(projectId, {
            step: 'pages',
            totalPages: plannedPages.length,
            currentPage: 0,
            lastHeartbeat: new Date().toISOString()
        })
        addLog({ taskId: projectId, type: 'generate_step', message: `页面规划完成，共 ${plannedPages.length} 个页面`, detail: plannedPages.map(p => p.name).join('、'), timestamp: new Date().toISOString() })

        // 第二步：逐页生成 HTML
        const generatedPages: Array<{ id: string; name: string; description: string; prompt: string; htmlContent: string }> = []
        const completedPages: Array<{ id: string; name: string }> = []

        for (let i = 0; i < plannedPages.length; i++) {
            if (taskState.cancelled) return

            const page = plannedPages[i]

            // 更新当前生成进度
            updateProjectProgress(projectId, {
                currentPage: i + 1,
                currentPageName: page.name,
                lastHeartbeat: new Date().toISOString()
            })
            addLog({ taskId: projectId, type: 'generate_step', message: `步骤2：正在生成页面 ${i + 1}/${plannedPages.length}：${page.name}`, timestamp: new Date().toISOString() })

            const htmlRaw = await callAIWithHeartbeat(
                'prototype-page',
                { appName, page, clientType, pageIndex: i, totalPages: plannedPages.length },
                apiKey, baseUrl, model,
                projectId, taskState,
                prompts?.['prototype-page']
            )

            if (taskState.cancelled) return

            // 提取 HTML
            let htmlContent = htmlRaw
            const htmlMatch = htmlRaw.match(/```html\s*([\s\S]*?)\s*```/)
            if (htmlMatch) htmlContent = htmlMatch[1]

            generatedPages.push({
                id: page.id,
                name: page.name,
                description: page.description,
                prompt: page.description,
                htmlContent
            })

            completedPages.push({ id: page.id, name: page.name })

            // 更新已完成页面列表
            updateProjectProgress(projectId, {
                completedPages: [...completedPages],
                lastHeartbeat: new Date().toISOString()
            })
            addLog({ taskId: projectId, type: 'generate_step', message: `页面「${page.name}」生成完成`, timestamp: new Date().toISOString() })
        }

        // 保存结果
        const project = getProjectById(projectId)
        if (project) {
            project.data = { appName, clientType, pages: generatedPages }
            project.status = 'completed'
            project.progress = { step: 'done', totalPages: generatedPages.length, currentPage: generatedPages.length, currentPageName: '', completedPages, lastHeartbeat: new Date().toISOString() }
            project.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
            saveProject(project)
        }

        addLog({ taskId: projectId, type: 'status_change', message: '状态变更: → 已完成', timestamp: new Date().toISOString() })
        addLog({ taskId: projectId, type: 'generate_done', message: `生成完成，共 ${generatedPages.length} 个页面`, timestamp: new Date().toISOString() })
        logger.info(moduleName, `原型生成任务完成 | ID: ${projectId}`)

    } catch (err) {
        if (taskState.cancelled) return
        const errMsg = err instanceof Error ? err.message : '生成失败，请重试'
        updateProjectStatusAndProgress(projectId, 'failed', { step: 'error', errorMessage: errMsg }, errMsg)
        addLog({ taskId: projectId, type: 'status_change', message: '状态变更: → 失败', timestamp: new Date().toISOString() })
        addLog({ taskId: projectId, type: 'error', message: `生成失败: ${errMsg}`, timestamp: new Date().toISOString() })
        logger.error(moduleName, `生成任务失败: ${errMsg} | ID: ${projectId}`)
    }
}

/** 调用 AI（带心跳更新） */
async function callAIWithHeartbeat(
    type: AIType,
    payload: Record<string, unknown>,
    apiKey: string,
    baseUrl: string,
    model: string | undefined,
    projectId: string,
    taskState: TaskState,
    systemPrompt?: string
): Promise<string> {
    const prompt = buildPrompt(type, payload)

    // 启动心跳定时器
    const heartbeatTimer = setInterval(() => {
        if (!taskState.cancelled) {
            updateProjectProgress(projectId, { lastHeartbeat: new Date().toISOString() })
        }
    }, HEARTBEAT_INTERVAL_MS)

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || 'deepseek-reasoner',
                messages: systemPrompt && systemPrompt.trim()
                    ? [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ]
                    : [{ role: 'user', content: prompt }],
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
            if (taskState.cancelled) {
                reader.cancel()
                throw new Error('任务已取消')
            }

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
                        if (delta) fullContent += delta
                    } catch {
                        // 忽略 JSON 解析错误
                    }
                }
            }
        }

        return fullContent
    } finally {
        clearInterval(heartbeatTimer)
    }
}

/** 解析 JSON */
export function parseJSON<T>(text: string): T | null {
    try {
        const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/)
        if (match) {
            const jsonStr = match[1] || match[0]
            return JSON.parse(jsonStr) as T
        }
        return JSON.parse(text) as T
    } catch {
        return null
    }
}
