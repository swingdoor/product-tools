/**
 * webSearch.ts — 多源联网搜索服务（国内可访问数据源）
 *
 * 支持的数据源：
 *   - bing_cn  : 必应中国（通用搜索，默认推荐）
 *   - baidu    : 百度搜索（通用搜索）
 *   - xinhua   : 新华网（政策/新闻）
 *   - xueqiu   : 雪球（金融/股市信息）
 *   - c36kr    : 36氪（科技/创投）
 */

import * as cheerio from 'cheerio'
import { logger } from '../logger'

// ============================================================
// 类型定义
// ============================================================

/** 可选的搜索数据源 */
export type SearchSourceId = 'bing_cn' | 'baidu' | 'xinhua' | 'xueqiu' | 'c36kr'

/** 联网搜索配置 */
export interface WebSearchConfig {
    enabled: boolean
    sources: SearchSourceId[]
}

/** 单条搜索结果 */
export interface SearchResult {
    title: string
    url: string
    snippet: string
    source: string  // 来源名称，如"必应"
}

/** 数据源描述 */
export const SEARCH_SOURCE_META: Record<SearchSourceId, { label: string; domain: string; desc: string }> = {
    bing_cn: { label: '必应搜索', domain: 'cn.bing.com', desc: '通用网页搜索，结果丰富（推荐）' },
    baidu: { label: '百度搜索', domain: 'www.baidu.com', desc: '国内最大搜索引擎' },
    xinhua: { label: '新华网', domain: 'so.news.cn', desc: '官方权威新闻与政策信息' },
    xueqiu: { label: '雪球', domain: 'xueqiu.com', desc: '股票、基金、财经资讯' },
    c36kr: { label: '36氪', domain: '36kr.com', desc: '科技创业与投资资讯' }
}

// ============================================================
// 公共工具函数
// ============================================================

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.5',
    'Connection': 'keep-alive',
}

async function fetchHtml(url: string, extraHeaders: Record<string, string> = {}): Promise<string> {
    const resp = await fetch(url, {
        headers: { ...DEFAULT_HEADERS, ...extraHeaders },
        // @ts-ignore — Electron Node 支持 signal，但 TS 类型可能不含 dispatcher
        signal: AbortSignal.timeout(8000)
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${url}`)
    const buf = await resp.arrayBuffer()
    // 先尝试 utf-8，百度部分接口返回 gbk
    return new TextDecoder('utf-8').decode(buf)
}

function clean(text: string): string {
    return text.replace(/\s+/g, ' ').trim()
}

// ============================================================
// 必应中国（cn.bing.com）爬取器
// 结构稳定，结果质量高，强烈推荐
// ============================================================
async function scrapeBingCN(keyword: string): Promise<SearchResult[]> {
    const url = `https://cn.bing.com/search?q=${encodeURIComponent(keyword)}&cc=CN&setlang=zh-hans`
    const html = await fetchHtml(url, { Referer: 'https://cn.bing.com/' })
    const $ = cheerio.load(html)
    const results: SearchResult[] = []

    $('li.b_algo').each((_i, el) => {
        if (results.length >= 5) return false
        const titleEl = $(el).find('h2 a')
        const title = clean(titleEl.text())
        const href = titleEl.attr('href') || ''
        const snippet = clean($(el).find('.b_caption p, .b_paractl').first().text())
        if (title && href.startsWith('http') && snippet) {
            results.push({ title, url: href, snippet, source: '必应搜索' })
        }
    })

    return results
}

// ============================================================
// 百度搜索（www.baidu.com）爬取器
// ============================================================
async function scrapeBaidu(keyword: string): Promise<SearchResult[]> {
    const url = `https://www.baidu.com/s?wd=${encodeURIComponent(keyword)}&ie=utf-8&rn=10`
    const html = await fetchHtml(url, { Referer: 'https://www.baidu.com/' })
    const $ = cheerio.load(html)
    const results: SearchResult[] = []

    // 百度结果在 data-click 属性或 h3.t > a 中
    $('div.result, div.result-op').each((_i, el) => {
        if (results.length >= 5) return false
        const titleEl = $(el).find('h3.t a, h3 a').first()
        const title = clean(titleEl.text())
        // 百度的 href 是重定向链接，尝试提取 data-log 或直接使用
        let href = titleEl.attr('href') || ''
        // 有时候真实 URL 在 data-log 中，这里直接使用跳转链接
        const snippet = clean($(el).find('div.c-abstract, .c-span9 .c-color-text, .c-row .c-span-last').first().text())
        if (title && href && snippet) {
            // 百度 href 是 /link?url=XXX 格式，保留原始跳转链接使用
            if (!href.startsWith('http')) href = 'https://www.baidu.com' + href
            results.push({ title, url: href, snippet, source: '百度搜索' })
        }
    })

    return results
}

// ============================================================
// 新华网搜索（so.news.cn）爬取器
// ============================================================
async function scrapeXinhua(keyword: string): Promise<SearchResult[]> {
    // 新华网搜索有 JSON API 接口
    const url = `https://so.news.cn/getNews?keyword=${encodeURIComponent(keyword)}&lang=cn&curPage=1&searchFields=1&sortField=0`
    try {
        const resp = await fetch(url, {
            headers: { ...DEFAULT_HEADERS, Referer: 'https://so.news.cn/' },
            signal: AbortSignal.timeout(8000)
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json = await resp.json()
        const items: any[] = json?.content?.results || []
        return items.slice(0, 5).map(item => ({
            title: clean(item.title?.replace(/<[^>]+>/g, '') || ''),
            url: item.url || '',
            snippet: clean(item.summary?.replace(/<[^>]+>/g, '') || ''),
            source: '新华网'
        })).filter(r => r.title && r.url)
    } catch (err) {
        // 如果 API 失败，尝试爬取首页搜索结果
        logger.warn('WebSearch', `新华网 API 失败，跳过: ${err instanceof Error ? err.message : String(err)}`)
        return []
    }
}

// ============================================================
// 雪球（xueqiu.com）爬取器——金融信息
// ============================================================
async function scrapeXueqiu(keyword: string): Promise<SearchResult[]> {
    // 雪球有搜索 API
    const url = `https://xueqiu.com/query/v1/search/general?q=${encodeURIComponent(keyword)}&count=5&source=user,news,post`
    try {
        const resp = await fetch(url, {
            headers: {
                ...DEFAULT_HEADERS,
                Referer: 'https://xueqiu.com/',
                Cookie: 'xq_a_token=dummy' // 部分接口需要 cookie 才不重定向
            },
            signal: AbortSignal.timeout(8000)
        })
        const json = await resp.json()
        const items: any[] = json?.data?.query_result?.original?.items || []
        return items.slice(0, 5).map((item: any) => ({
            title: clean(item.title || item.text || ''),
            url: item.target || `https://xueqiu.com${item.path || ''}`,
            snippet: clean(item.description || item.text || '').slice(0, 200),
            source: '雪球'
        })).filter(r => r.title)
    } catch (err) {
        logger.warn('WebSearch', `雪球搜索失败，尝试 HTML 爬取: ${err instanceof Error ? err.message : String(err)}`)
        // Fallback：爬取 HTML 页面
        try {
            const html = await fetchHtml(
                `https://xueqiu.com/k?q=${encodeURIComponent(keyword)}`,
                { Referer: 'https://xueqiu.com/' }
            )
            const $ = cheerio.load(html)
            const results: SearchResult[] = []
            $('.article-list .item, .timeline-item').each((_i, el) => {
                if (results.length >= 5) return false
                const titleEl = $(el).find('h2 a, .title a').first()
                const title = clean(titleEl.text())
                const href = titleEl.attr('href') || ''
                const snippet = clean($(el).find('.description, .body').first().text()).slice(0, 200)
                if (title && (href.startsWith('http') || href.startsWith('/'))) {
                    results.push({
                        title,
                        url: href.startsWith('/') ? 'https://xueqiu.com' + href : href,
                        snippet: snippet || title,
                        source: '雪球'
                    })
                }
            })
            return results
        } catch {
            return []
        }
    }
}

// ============================================================
// 36氪（36kr.com）爬取器——科技/创投
// ============================================================
async function scrape36KR(keyword: string): Promise<SearchResult[]> {
    const url = `https://36kr.com/search/articles/${encodeURIComponent(keyword)}`
    try {
        const html = await fetchHtml(url, { Referer: 'https://36kr.com/' })
        const $ = cheerio.load(html)
        const results: SearchResult[] = []

        // 36kr 文章列表
        $('a.article-item-title, .article-detail-title a, h3.title a').each((_i, el) => {
            if (results.length >= 5) return false
            const title = clean($(el).text())
            const href = $(el).attr('href') || ''
            if (title && href) {
                results.push({
                    title,
                    url: href.startsWith('/') ? 'https://36kr.com' + href : href,
                    snippet: '', // 36kr 列表页不显示摘要
                    source: '36氪'
                })
            }
        })

        return results
    } catch (err) {
        logger.warn('WebSearch', `36kr 爬取失败: ${err instanceof Error ? err.message : String(err)}`)
        return []
    }
}

// ============================================================
// 主入口：多源并行搜索 + 去重合并
// ============================================================
export async function webSearch(keyword: string, config: WebSearchConfig): Promise<string> {
    if (!config.enabled || !config.sources || config.sources.length === 0) {
        logger.info('WebSearch', '搜索已禁用或未配置数据源')
        return ''
    }

    logger.info('WebSearch', '开始并行搜索', `KeywordLen=${keyword.length}, Sources=[${config.sources.join(',')}]`)

    // 并行调用所有配置的数据源
    const scrapers: Record<SearchSourceId, (kw: string) => Promise<SearchResult[]>> = {
        bing_cn: scrapeBingCN,
        baidu: scrapeBaidu,
        xinhua: scrapeXinhua,
        xueqiu: scrapeXueqiu,
        c36kr: scrape36KR,
    }

    const tasks = config.sources.map(async (sourceId) => {
        try {
            const results = await scrapers[sourceId]?.(keyword) || []
            logger.info('WebSearch', `${sourceId} 搜索完成 | 找到 ${results.length} 条结果`)
            return results
        } catch (err) {
            logger.error('WebSearch', `${sourceId} 搜索失败: ${err instanceof Error ? err.message : String(err)}`)
            return [] as SearchResult[]
        }
    })

    const allResultsNested = await Promise.allSettled(tasks)
    const allResults: SearchResult[] = []
    const seenUrls = new Set<string>()

    for (const r of allResultsNested) {
        if (r.status === 'fulfilled') {
            for (const item of r.value) {
                if (!seenUrls.has(item.url) && item.title && item.url) {
                    seenUrls.add(item.url)
                    allResults.push(item)
                }
            }
        }
    }

    // 最多取前 8 条
    const topResults = allResults.slice(0, 8)
    logger.info('WebSearch', '搜索最终完成', `唯一结果数: ${topResults.length}`)

    if (topResults.length === 0) return ''

    // 格式化为 AI 可读的引用列表
    return topResults.map((r, i) =>
        `[${i + 1}] 标题: ${r.title}\n来源: ${r.source}\n链接: ${r.url}\n摘要: ${r.snippet || '（无摘要）'}`
    ).join('\n\n---\n\n')
}
