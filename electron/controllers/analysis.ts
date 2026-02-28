import { analysisService } from '../services/analysisService'
import { systemRepo } from '../db/repositories/systemRepo'
import { TaskState, HEARTBEAT_INTERVAL_MS } from '../services/taskRunner'
import { logger } from '../logger'

/** 执行分析任务 */
export async function executeAnalysisTask(
    taskId: string,
    inputContent: string,
    apiKey: string,
    baseUrl: string,
    model: string | undefined,
    taskState: TaskState,
    prompts?: Record<string, string>
) {
    const moduleName = 'ProductAnalysis'
    logger.info(moduleName, '开始执行分析任务', `ID: ${taskId}`)
    try {
        systemRepo.addLog({ taskId, type: 'generate_step', message: '正在分析产品需求...', timestamp: new Date().toISOString() })

        // 调用 AI 分析
        const result = await callAnalysisAIWithHeartbeat(
            inputContent, apiKey, baseUrl, model, taskId, taskState, prompts?.['product-analysis']
        )

        if (taskState.cancelled) return

        // 保存结果
        analysisService.updateStatus(taskId, 'completed', {
            resultContent: result,
            progress: { lastHeartbeat: new Date().toISOString() }
        })

        systemRepo.addLog({ taskId, type: 'status_change', message: '状态变更: → 已完成', timestamp: new Date().toISOString() })
        systemRepo.addLog({ taskId, type: 'generate_done', message: '分析完成', timestamp: new Date().toISOString() })
        logger.info(moduleName, '分析任务完成', `ID: ${taskId}`)

    } catch (err) {
        if (taskState.cancelled) return
        const errMsg = err instanceof Error ? err.message : '分析失败，请重试'
        analysisService.updateStatus(taskId, 'failed', { errorMessage: errMsg })
        systemRepo.addLog({ taskId, type: 'status_change', message: '状态变更: → 失败', timestamp: new Date().toISOString() })
        systemRepo.addLog({ taskId, type: 'error', message: `分析失败: ${errMsg}`, timestamp: new Date().toISOString() })
        logger.error(moduleName, `分析任务失败: ${errMsg}`, `ID: ${taskId}`)
    }
}

/** 调用 AI 分析（带心跳） */
async function callAnalysisAIWithHeartbeat(
    inputContent: string,
    apiKey: string,
    baseUrl: string,
    model: string | undefined,
    taskId: string,
    taskState: TaskState,
    systemPrompt?: string
): Promise<string> {
    const prompt = `基于以下市场洞察报告，请生成详细的产品需求分析方案：

${inputContent}

分析要求：请按以下结构输出（使用Markdown格式）：
1. **产品定位**：目标用户、核心价值、差异化定位
2. **需求清单**：以表格形式列出（优先级P0/P1/P2、需求描述、用户场景、价值点）
3. **功能模块**：核心功能架构和模块划分
4. **差异化优势**：相比竞品的核心差异点
5. **设计方案**：关键交互设计和用户体验要点
6. **可行性分析**：技术可行性、商业可行性、风险评估`

    // 启动心跳定时器
    const heartbeatTimer = setInterval(() => {
        if (!taskState.cancelled) {
            analysisService.updateHeartbeat(taskId)
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
