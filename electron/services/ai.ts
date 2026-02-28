import { updateMarketReportHeartbeat, updateProjectProgress, updateDesignDocProgress } from '../store'
import { TaskState, HEARTBEAT_INTERVAL_MS } from './taskRunner'

export type AIType = 'market-insight' | 'product-analysis' | 'prototype-plan' | 'prototype-page'

export interface AICallParams {
  type: AIType
  payload: Record<string, unknown>
  apiKey: string
  baseUrl: string
  model?: string
  systemPrompt?: string
}

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
      return `请为以下行业生成一份详细的市场洞察报告：\n- 行业/领域：${industry}${targetStr}${focusStr}${dataStr}\n\n报告要求：结构完整、数据详实、分析深入，使用Markdown格式，包含执行摘要、各维度详细分析和战略建议。`
    }
    case 'product-analysis': {
      const { reportContent } = payload as { reportContent: string }
      return `基于以下市场洞察报告，请生成详细的产品需求分析方案：\n\n${reportContent}\n\n分析要求：请按以下结构输出（使用Markdown格式）：\n1. **产品定位**：目标用户、核心价值、差异化定位\n2. **需求清单**：以表格形式列出（优先级P0/P1/P2、需求描述、用户场景、价值点）\n3. **功能模块**：核心功能架构和模块划分\n4. **差异化优势**：相比竞品的核心差异点\n5. **设计方案**：关键交互设计和用户体验要点\n6. **可行性分析**：技术可行性、商业可行性、风险评估`
    }

    case 'prototype-plan': {
      const { analysisContent, clientType } = payload as { analysisContent: string; clientType: string }
      const canvasInfo = getCanvasInfoByClientType(clientType)
      return `基于以下产品需求分析方案，规划产品原型的页面架构：

${analysisContent}

【客户端类型】：${clientType}
【画布规格】：${canvasInfo.desc}

请分析产品需求，规划需要设计的完整页面列表，并为每个页面提供详细描述。

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
      return `为产品“${appName}”生成第 ${pageIndex + 1}/${totalPages} 个页面的完整 HTML 代码。

【页面信息】
- 页面名称：${page.name}
- 页面描述：${page.description}

【客户端类型】：${clientType}
【页面尺寸】：${canvasInfo.width}×${canvasInfo.height}px

【设计规范】：
- 主色：#165DFF，背景：#F5F7FA，卡片：#FFFFFF，主文字：#1D2129，次文字：#4E5969
- 统一字体：-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- 圆角：8px，阴影：0 2px 8px rgba(0,0,0,0.08)
${canvasInfo.layoutGuide}

【输出要求】：
1. 生成完整的 HTML 文件，包含 <!DOCTYPE html>、<html>、<head>、<body>
2. 所有样式写在 <style> 标签内，不使用外部 CSS
3. 使用语义化 HTML5 标签（header, nav, main, section, footer 等）
4. 页面内容完整，包含所有描述中的功能区域
5. 使用占位符图片（绘制矩形+文字提示）
6. 添加 hover 状态、过渡动画提升交互体验
7. 页面底部添加导航链接到其他页面（使用 # + 页面名称作为 href）

只输出 HTML 代码，不要包含任何解释或 markdown 标记。`
    }
    default:
      return ''
  }
}

export function getCanvasInfoByClientType(clientType: string): { width: number; height: number; desc: string; layoutGuide: string } {
  switch (clientType) {
    case '移动端（iOS/Android）':
      return {
        width: 390,
        height: 844,
        desc: '390×844px（iPhone 14标准尺寸）',
        layoutGuide: '- 布局特点：顶部状态栏44px，底部导航栏83px，内容区竖向排列，全宽组件'
      }
    case '平板端（iPad）':
      return {
        width: 1024,
        height: 1366,
        desc: '1024×1366px（iPad Pro 12.9寸）',
        layoutGuide: '- 布局特点：可使用分栏布局，左侧导航200px，右侧内容区'
      }
    case '桌面客户端':
      return {
        width: 1440,
        height: 900,
        desc: '1440×900px（标准桌面端）',
        layoutGuide: '- 布局特点：顶部导航栏60px，左侧侧边栏220px，主内容区，右侧属性栏（可选）'
      }
    case '小程序':
      return {
        width: 375,
        height: 812,
        desc: '375×812px（微信小程序标准尺寸）',
        layoutGuide: '- 布局特点：顶部自定义导航44px，底部tabbar50px，内容区竖向排列'
      }
    case 'Web端':
    default:
      return {
        width: 1280,
        height: 900,
        desc: '1280×900px（标准Web端）',
        layoutGuide: '- 布局特点：顶部导航栏60px，左侧侧边栏220px，主内容区填充剩余宽度'
      }
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
      updateMarketReportHeartbeat(reportId)
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
      updateProjectProgress(projectId, {
        lastHeartbeat: new Date().toISOString()
      })
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
          } catch { }
        }
      }
    }

    return fullContent
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
  systemPrompt?: string
): Promise<string> {
  const prompt = `你是一位专业的产品设计师，请根据以下 HTML 页面代码，生成该页面的功能设计说明文档。

**页面名称**: ${page.name}
**页面描述**: ${page.description}

**HTML 代码**:
\`\`\`html
${page.htmlContent}
\`\`\`

请输出包含以下内容的 Markdown 格式文档：

### 页面概述
简要描述页面的主要用途和在产品中的位置

### 功能点清单
列出页面包含的所有功能点

### 交互逻辑说明
详细说明用户交互流程和各元素的交互行为

### 数据字段说明
列出页面涉及的数据字段及其类型、用途

### 异常状态处理
说明各种异常场景的处理方式

请确保内容专业、结构清晰、实用性强。`

  const heartbeatTimer = setInterval(() => {
    if (!taskState.cancelled) {
      updateDesignDocProgress(docId, {
        lastHeartbeat: new Date().toISOString()
      })
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
        messages: [{ role: 'user', content: prompt }],
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
          } catch { }
        }
      }
    }

    return fullContent
  } finally {
    clearInterval(heartbeatTimer)
  }
}
