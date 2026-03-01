/**
 * webSearch.ts — 联网搜索服务 (Deep Research)
 *
 * 目前主力由 博查 Web Search API 提供支持
 * (专为 AI Agent 和 RAG 设计的高质量搜索方案)
 */

import { logger } from '../logger'

// ============================================================
// 类型定义
// ============================================================

/** 联网搜索配置 */
export interface WebSearchConfig {
    enabled: boolean
    bochaApiKey?: string
    // 用于多轮提问扩展阶段的大模型凭证
    apiKey?: string
    baseUrl?: string
    model?: string
    // 用于向 UI 推送详细日志
    onLog?: (msg: string) => void
}

/** 单条搜索结果 */
export interface SearchResult {
    title: string
    url: string
    snippet: string
    source: string  // 来源名称
}

/** 博查 API 响应结构 (关键字段) */
interface BochaApiResponse {
    code: number
    msg: string
    data?: {
        webPages?: {
            value?: Array<{
                id: string
                name: string
                url: string
                snippet: string
                siteName?: string
                summary?: string // 长文本摘要
            }>
        }
    }
}

// ============================================================
// 博查 Web Search API 集成
// ============================================================

/**
 * 调用博查 API 执行搜索
 */
async function fetchBochaSearch(keyword: string, apiKey: string): Promise<SearchResult[]> {
    if (!apiKey) {
        throw new Error('未配置博查 API Key')
    }

    const url = 'https://api.bochaai.com/v1/web-search'

    // 构造博查 API 请求体
    // https://open.bochaai.com/docs/api-reference/web-search
    const requestBody = {
        query: keyword,
        summary: true, // 开启长文本摘要，提供更丰富的上下文
        count: 10,     // 每次搜索返回的结果数量
        freshness: 'noLimit' // 时间范围：一天内、一周内、一个月内、一年内、不限
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                // 可以添加类似 User-Agent 等基础头信息
            },
            body: JSON.stringify(requestBody),
            // @ts-ignore
            signal: AbortSignal.timeout(15000) // 给 API 充足的响应时间
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const data: BochaApiResponse = await response.json()

        if (data.code !== 200) {
            throw new Error(`API Error ${data.code}: ${data.msg}`)
        }

        const results: SearchResult[] = []
        const pages = data.data?.webPages?.value || []

        for (const page of pages) {
            if (page.name && page.url) {
                // 优先使用长文本摘要，如果不存在则使用短 snippet
                const content = (page.summary || page.snippet || '').trim()
                if (content) {
                    results.push({
                        title: page.name,
                        url: page.url,
                        snippet: content,
                        source: page.siteName || '博查搜索'
                    })
                }
            }
        }

        return results
    } catch (err) {
        logger.error('WebSearch', `博查 API 调用失败: ${err instanceof Error ? err.message : String(err)}`)
        throw err
    }
}

// ============================================================
// 大模型查询意图扩展
// ============================================================

/**
 * 利用大模型将用户的主题关键词拆解为多个子维度的搜索关键词
 */
async function expandSearchQueries(keyword: string, config: WebSearchConfig): Promise<string[]> {
    if (!config.apiKey || !config.baseUrl) {
        logger.warn('WebSearch', '未传 AI 凭证，跳过关键字扩展，回退到主要关键字单次搜索')
        return [keyword]
    }

    const systemPrompt = `你是一个专业的搜索提示词工程师（Prompt Engineer）。
用户想要深度研究一个课题。请你将这个课题**横向拆解**为 3 个不同维度的独立搜索关键词（例如：市场规模与增长率、核心竞品分析、最新技术趋势等）。
请务必返回一个合法的 JSON 数组，例如：["关键词1", "关键词2", "关键词3"]，不要包含任何其他文字或 markdown 解释。`

    try {
        logger.info('WebSearch', '正在请求 AI 进行搜索关键词扩展...', `Keyword=${keyword}`)
        config.onLog?.('🧠 正在使用 AI 模型拆解与扩展搜索维度...')
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: config.model || 'deepseek-chat', // 使用普通模型即可，不需要 reasoning
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `课题：${keyword}` }
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' } // 部分模型支持强制 JSON
            })
        })

        if (!response.ok) {
            throw new Error(`AI Request Failed: ${response.status}`)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || '[]'

        let queries: string[] = []
        try {
            // 尝试直接解析
            const parsed = JSON.parse(content)
            if (Array.isArray(parsed) && parsed.length > 0) {
                queries = parsed
            } else if (parsed.queries && Array.isArray(parsed.queries)) {
                queries = parsed.queries
            }
        } catch (_) {
            // 兜底提取数组串
            const match = content.match(/\[(.*?)\]/s)
            if (match) {
                try {
                    queries = JSON.parse(`[${match[1]}]`)
                } catch { }
            }
        }

        if (queries.length > 0) {
            // 保留原始词，合并新产生的词（去重），最多留4个
            const uniqueQueries = Array.from(new Set([keyword, ...queries])).slice(0, 4)
            logger.info('WebSearch', '关键词扩展成功', `扩展后 keywords: [${uniqueQueries.join(', ')}]`)
            if (uniqueQueries.length > 1) {
                config.onLog?.(`✨ 挖掘到 ${uniqueQueries.length} 个独立检索维度: [${uniqueQueries.join('、')}]`)
            }
            return uniqueQueries
        }
    } catch (err) {
        logger.warn('WebSearch', `关键词扩展失败: ${err instanceof Error ? err.message : String(err)}`)
    }

    // 发生任何异常，回退使用原始关键字
    return [keyword]
}

// ============================================================
// 主入口
// ============================================================

export async function webSearch(keyword: string, config: WebSearchConfig): Promise<string> {
    // 1. 检查配置是否开启
    if (!config.enabled) {
        logger.info('WebSearch', '联网搜索未开启')
        return ''
    }

    // 2. 检查是否配置了 API Key
    const apiKey = config.bochaApiKey?.trim()
    if (!apiKey) {
        logger.warn('WebSearch', '启用联网搜索但未配置 Bocha API Key')
        // 返回一段特殊提示给大模型，让大模型知道搜索功能当前受限
        return '[系统提示] 此任务尝试进行联网搜索，但用户未配置博查 API Key，搜索受限。请仅根据你现有的知识进行回答。'
    }

    logger.info('WebSearch', '开始 Deep Research (多维并发搜索)', `Keyword=${keyword}`)
    config.onLog?.(`🔍 启动多维并发搜索 (主题: ${keyword})...`)

    try {
        // 3. AI 辅助拆解/扩展查询词
        const queries = await expandSearchQueries(keyword, config)

        // 4. 并发调用博查 API
        const tasks = queries.map(q => fetchBochaSearch(q, apiKey))
        const settledResults = await Promise.allSettled(tasks)

        // 5. 汇总合并、URL去重
        const allResults: SearchResult[] = []
        const seenUrls = new Set<string>()

        for (let i = 0; i < settledResults.length; i++) {
            const res = settledResults[i]
            if (res.status === 'fulfilled') {
                for (const item of res.value) {
                    if (!seenUrls.has(item.url)) {
                        seenUrls.add(item.url)
                        allResults.push(item)
                    }
                }
            } else {
                logger.warn('WebSearch', `子查询 [${queries[i]}] 失败: ${res.reason}`)
            }
        }

        // 截取前 15 条最高相关度的结果 (多维度会产生很多结果)
        const finalResults = allResults.slice(0, 15)
        logger.info('WebSearch', 'Deep Research 合并完成', `共获取到 ${finalResults.length} 条独特结果信息。`)
        config.onLog?.(`📥 检索完成：成功汇聚并去除了重复项，最终提取 ${finalResults.length} 条高价值文献摘要作为超级上下文。`)

        if (finalResults.length === 0) {
            config.onLog?.('⚠️ 抱歉，未能检索到任何相关信息。')
            return `[系统提示] 对于主题 "${keyword}" 以及其衍生词，未找到相关的网络信息。`
        }

        // 6. 格式化为 AI 可读的引用列表结构
        // 增加详细的 markdown 层级结构，让大模型更容易解析和引用
        return finalResults.map((r, i) =>
            `### 来源 [${i + 1}]: ${r.title}\n` +
            `- **站点名称**: ${r.source}\n` +
            `- **链接**: ${r.url}\n` +
            `- **详细摘要/内容**:\n  ${r.snippet.replace(/\n/g, '\n  ')}`
        ).join('\n\n---\n\n')

    } catch (err) {
        // 搜索失败时，记录错误但不让主流程中断
        logger.error('WebSearch', '网络搜索过程发生严重异常', err instanceof Error ? err.stack : String(err))
        return `[系统提示] 尝试获取最新网络信息失败 (${err instanceof Error ? err.message : '未知错误'})。请仅根据你现有的知识进行推演。`
    }
}
