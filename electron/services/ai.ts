import { marketService } from './marketService'
import { projectService } from './projectService'
import { designDocService } from './designDocService'
import { TaskState, HEARTBEAT_INTERVAL_MS } from './taskRunner'

export type AIType = 'market-insight' | 'product-analysis' | 'prototype-plan' | 'prototype-page'
import { ClientTypes } from '../../src/constants/clientTypes'

export interface AICallParams {
  type: AIType
  payload: Record<string, unknown>
  apiKey: string
  baseUrl: string
  model?: string
  systemPrompt?: string
}

import { logger } from '../logger'

export function buildPrompt(type: AIType, payload: Record<string, unknown>): string {
  switch (type) {
    case 'market-insight': {
      const { industry, targetUsers, focusAreas, dataSources } = payload as {
        industry: string
        targetUsers?: string
        focusAreas?: string[]
        dataSources?: string
      }
      const focusStr = focusAreas?.length ? `\n- 核心关注方向：${focusAreas.join('、')}` : ''
      const targetStr = targetUsers ? `\n- 目标用户群体：${targetUsers}` : ''
      const dataStr = dataSources ? `\n- 参考数据源：\n${dataSources}` : ''
      return `请为以下行业生成一份详细的市场洞察报告：\n- 行业/领域：${industry}${targetStr}${focusStr}${dataStr}\n\n请严格遵循系统设定（System Prompt）中定义的报告结构与分析标准完成撰写。`
    }
    case 'product-analysis': {
      const { reportContent } = payload as { reportContent: string }
      return `基于以下市场洞察报告，请生成详细的产品需求分析方案：\n\n${reportContent}\n\n请严格按系统设定（System Prompt）中定义的产品规范约束进行推导和结构输出。`
    }

    case 'prototype-plan': {
      const { analysisContent, clientType, knowledgePromptExtension } = payload as { analysisContent: string; clientType: string; knowledgePromptExtension?: string }
      const canvasInfo = getCanvasInfoByClientType(clientType)
      let basePrompt = `基于以下产品需求分析方案，规划产品原型的页面架构：

${analysisContent}

【客户端类型】：${clientType}
【画布规格】：${canvasInfo.desc}

请分析产品需求，规划需要设计的完整页面列表，并为每个页面提供详细描述。`

      if (knowledgePromptExtension) {
        basePrompt += knowledgePromptExtension
      }

      return basePrompt + `

输出格式（严格JSON）：
{
  "appName": "应用名称",
  "clientType": "${clientType}",
  "pages": [
    {
      "id": "page_home",
      "name": "首页",
      "description": "详细描述..."
    }
  ]
}`
    }
    case 'prototype-page': {
      const { appName, page, clientType, pageIndex, totalPages, customPrompt } = payload as {
        appName?: string
        page?: { id: string; name: string; description: string }
        clientType?: string
        pageIndex?: number
        totalPages?: number
        customPrompt?: string
      }

      if (customPrompt) return customPrompt

      if (!appName || !page || !clientType || pageIndex === undefined || totalPages === undefined) {
        return '请提供完整的页面信息'
      }

      const canvasInfo = getCanvasInfoByClientType(clientType)
      return `为产品“${appName}”设计并生成页面的完整 HTML 代码。

【页面基本信息】
- 页面名称：${page.name}
- 页面描述：${page.description}
- 目标设备：${clientType}

请严格遵循系统设定（System Prompt）中的代码框架、排版原则与约束规范完成页面编写。
只需直接输出包含 \`<!DOCTYPE html>\` 结构的完整源代码，不要包含任何 markdown 代码块标记，不要多余解释。`
    }
    default:
      return ''
  }
}

export function getCanvasInfoByClientType(clientType: string): { width: number; height: number; desc: string; layoutGuide: string } {
  const typeKey = clientType as keyof typeof ClientTypes;
  if (ClientTypes[typeKey]) {
    return ClientTypes[typeKey];
  }

  // Fallback map for older deprecated string values from history
  if (clientType === '移动端（iOS/Android）') return ClientTypes.App;
  if (clientType === '平板端（iPad）') return ClientTypes.Pad;
  if (clientType === '桌面客户端' || clientType === 'Web端') return ClientTypes.Web;
  if (clientType === '小程序') return ClientTypes.MiniProgram;

  // Default fallback
  return ClientTypes.Web;
}

/** 通用的 AI 流式请求助手 */
async function requestStreamAI(
  params: {
    baseUrl: string
    apiKey: string
    model: string
    systemPrompt?: string
    userPrompt: string
    temperature?: number
  },
  taskState: TaskState,
  onDelta: (delta: string) => void
): Promise<string> {
  const response = await fetch(`${params.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.systemPrompt && params.systemPrompt.trim()
        ? [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt }
        ]
        : [{ role: 'user', content: params.userPrompt }],
      stream: true,
      temperature: params.temperature ?? 0.7
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

  try {
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
            if (delta) {
              fullContent += delta
              onDelta(delta)
            }
          } catch {
            // 忽略 JSON 解析错误
          }
        }
      }
    }
    return fullContent
  } finally {
    reader.releaseLock()
  }
}

/** 调用 AI 生成市场报告（带心跳） */
export async function callMarketAIWithHeartbeat(
  report: any,
  apiKey: string,
  baseUrl: string,
  model: string | undefined,
  reportId: string,
  taskState: TaskState,
  systemPrompt?: string
): Promise<string> {
  const focusAreasText = report.focusAreas?.length > 0 ? report.focusAreas.join('、') : '无特定关注方向'
  const targetUsersText = report.targetUsers || '未指定'
  const dataSourcesText = report.dataSources || '无额外参考数据'

  const prompt = `请基于以下输入信息，生成一份专业的市场洞察报告。
${report.dataSources ? '注意：参考资料中包含联网搜索获取的实时数据，请务必在文中关键结论处引用并注明来源。' : ''}

行业领域：${report.industry}
目标用户：${targetUsersText}
关注方向：${focusAreasText}
参考数据资料：
${dataSourcesText}

请务必严格遵守系统提示词（System Prompt）中定义的报告结构、文风要求以及引用规范。`

  const heartbeatTimer = setInterval(() => {
    if (!taskState.cancelled) {
      marketService.updateHeartbeat(reportId)
    }
  }, HEARTBEAT_INTERVAL_MS)

  logger.info('MarketInsight', '===== 提交给 LLM 的完整输入 =====')
  if (systemPrompt && systemPrompt.trim()) {
    logger.info('MarketInsight', '[System Prompt]:\n' + systemPrompt.trim())
  }
  logger.info('MarketInsight', '[User Prompt]:\n' + prompt)
  logger.info('MarketInsight', '====================================')

  try {
    return await requestStreamAI(
      {
        baseUrl,
        apiKey,
        model: model || 'deepseek-reasoner',
        systemPrompt,
        userPrompt: prompt
      },
      taskState,
      () => { }
    )
  } finally {
    clearInterval(heartbeatTimer)
  }
}

/** 普通通用带心跳的生成组件（如原型页面/分析）*/
export async function callAIWithHeartbeat(
  prompt: string,
  apiKey: string,
  baseUrl: string,
  model: string | undefined,
  projectId: string,
  taskState: TaskState,
  systemPrompt?: string
): Promise<string> {
  const heartbeatTimer = setInterval(() => {
    if (!taskState.cancelled) {
      projectService.updateProgress(projectId, {
        lastHeartbeat: new Date().toISOString()
      })
    }
  }, HEARTBEAT_INTERVAL_MS)

  logger.info('AI', '===== 提交给 LLM 的完整输入 =====')
  if (systemPrompt && systemPrompt.trim()) {
    logger.info('AI', '[System Prompt]:\n' + systemPrompt.trim())
  }
  logger.info('AI', '[User Prompt]:\n' + prompt)
  logger.info('AI', '====================================')

  try {
    return await requestStreamAI(
      {
        baseUrl,
        apiKey,
        model: model || 'deepseek-reasoner',
        systemPrompt,
        userPrompt: prompt
      },
      taskState,
      () => { }
    )
  } finally {
    clearInterval(heartbeatTimer)
  }
}

/** 生成单个页面的设计说明（带心跳） */
export async function generatePageDesignWithHeartbeat(
  page: { name: string; description: string; htmlContent: string },
  apiKey: string,
  baseUrl: string,
  model: string | undefined,
  docId: string,
  taskState: TaskState,
  systemPrompt?: string,
  knowledgePromptExtension?: string
): Promise<string> {
  let prompt = `请根据以下前端代码和页面信息，进行反向工程分析，输出详细的《页面组件及技术需求规格书》。

**页面名称**: ${page.name}
**页面描述**: ${page.description}

**来源HTML代码**:
\`\`\`html
${page.htmlContent}
\`\`\`

请严格遵照系统设定（System Prompt）中定义的技术维度和输出框架完成你的推演分析。`

  if (knowledgePromptExtension) {
    prompt += knowledgePromptExtension
  }

  const heartbeatTimer = setInterval(() => {
    if (!taskState.cancelled) {
      designDocService.updateProgress(docId, {
        lastHeartbeat: new Date().toISOString()
      })
    }
  }, HEARTBEAT_INTERVAL_MS)

  logger.info('DesignDoc', '===== 提交给 LLM 的完整输入 =====')
  if (systemPrompt && systemPrompt.trim()) {
    logger.info('DesignDoc', '[System Prompt]:\n' + systemPrompt.trim())
  }
  logger.info('DesignDoc', '[User Prompt]:\n' + prompt)
  logger.info('DesignDoc', '====================================')

  try {
    return await requestStreamAI(
      {
        baseUrl,
        apiKey,
        model: model || 'deepseek-reasoner',
        systemPrompt,
        userPrompt: prompt
      },
      taskState,
      () => { }
    )
  } finally {
    clearInterval(heartbeatTimer)
  }
}

/** 获取文本向量 Embedding */
export async function getEmbedding(
  text: string,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<number[]> {
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'text-embedding-v3',
      input: text
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Embedding API请求失败: ${response.status} - ${errText}`)
  }

  const result = await response.json()
  if (result.data && result.data.length > 0 && result.data[0].embedding) {
    return result.data[0].embedding
  }
  throw new Error('Embedding API返回格式异常')
}

