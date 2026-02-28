import { updateMarketReportStatus, addLog, type MarketReport } from '../store'
import { callMarketAIWithHeartbeat } from '../services/ai'
import type { TaskState } from '../services/taskRunner'
import { webSearch, type WebSearchConfig } from '../services/webSearch'
import { logger } from '../logger'

/** 执行市场报告生成任务 */
export async function executeMarketTask(
    reportId: string,
    report: MarketReport,
    apiKey: string,
    baseUrl: string,
    model: string | undefined,
    taskState: TaskState,
    prompts?: Record<string, string>,
    searchConfig?: WebSearchConfig
) {
    const moduleName = 'MarketInsight'
    logger.info(moduleName, `开始生成报告: ${report.title}`, `ID: ${reportId}`)

    try {
        let researchData = ''

        // 如果开启了 Deep Research、有行业信息、并且 searchConfig 已启用
        if (report.deepSearch && report.industry && searchConfig?.enabled) {
            const sourceList = (searchConfig.sources || ['bing_cn']).join(', ')
            logger.info(moduleName, '启动 Deep Research...', `Sources: ${sourceList}`)
            addLog({ taskId: reportId, type: 'generate_step', message: `🚀 启动 Deep Research：正在从 [${sourceList}] 检索实时信息...`, timestamp: new Date().toISOString() })

            const keywords = [report.industry, ...(report.focusAreas || [])].slice(0, 3).join(' ')
            researchData = await webSearch(keywords, searchConfig)

            if (researchData) {
                logger.info(moduleName, 'Deep Research 完成', '已获取实时搜索信息')
                addLog({ taskId: reportId, type: 'generate_step', message: '✅ Deep Research 完成：已获取最新行业动态与趋势', detail: '已将检索到的摘要融入分析上下文', timestamp: new Date().toISOString() })
            } else {
                logger.warn(moduleName, 'Deep Research 未能获取到信息')
                addLog({ taskId: reportId, type: 'generate_step', message: '⚠️ Deep Research 未能获取到额外信息，将使用大模型内置知识', timestamp: new Date().toISOString() })
            }
        } else if (report.deepSearch && !searchConfig?.enabled) {
            logger.warn(moduleName, 'Deep Research 开启但未配置数据源')
            addLog({ taskId: reportId, type: 'generate_step', message: '⚠️ 已勾选"联网搜索"但未在设置中启用任何数据源，将使用大模型内置知识', timestamp: new Date().toISOString() })
        } else {
            logger.info(moduleName, '使用 AI 直接分析市场...')
            addLog({ taskId: reportId, type: 'generate_step', message: '正在根据现有资料进行市场分析...', timestamp: new Date().toISOString() })
        }

        if (taskState.cancelled) {
            logger.info(moduleName, '任务已取消', `ID: ${reportId}`)
            return
        }

        // 将搜索到的数据合并到 report 中（临时克隆一份，不污染数据库里的原始输入）
        const enrichedReport = {
            ...report,
            dataSources: researchData
                ? `${report.dataSources || ''}\n\n[Deep Research 实时检索数据]:\n${researchData}`
                : report.dataSources
        }

        // 调用 AI 生成报告
        logger.info(moduleName, '调用 AI 服务进行生成...', `Model: ${model || 'default'}`)
        const result = await callMarketAIWithHeartbeat(
            enrichedReport, apiKey, baseUrl, model, reportId, taskState, prompts?.['market-insight']
        )

        if (taskState.cancelled) return

        // 保存结果
        updateMarketReportStatus(reportId, 'completed', {
            resultContent: result,
            progress: { lastHeartbeat: new Date().toISOString() }
        })

        addLog({ taskId: reportId, type: 'generate_done', message: '报告生成完成', timestamp: new Date().toISOString() })
        logger.info(moduleName, '报告生成成功', `ID: ${reportId}`)

    } catch (err) {
        if (taskState.cancelled) return
        const errMsg = err instanceof Error ? err.message : '生成失败，请重试'
        updateMarketReportStatus(reportId, 'failed', { errorMessage: errMsg })
        addLog({ taskId: reportId, type: 'error', message: `生成失败: ${errMsg}`, timestamp: new Date().toISOString() })
        logger.error(moduleName, `生成失败: ${errMsg}`, `ID: ${reportId}`)
    }
}
