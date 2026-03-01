import { knowledgeService } from '../services/knowledgeService'
import { systemRepo } from '../db/repositories/systemRepo'
import { logger } from '../logger'

export async function buildKnowledgeContext(
    taskId: string,
    mode: 'none' | 'auto' | 'manual' | undefined,
    docs: string[] | undefined,
    autoQuery: string,
    onLog?: (msg: string) => void
): Promise<string> {
    const moduleName = 'KnowledgeContext'
    logger.info(moduleName, `任务 ${taskId} 知识库引用模式: ${mode || 'none'}`)

    if (!mode || mode === 'none') {
        logger.info(moduleName, `未启用知识库引用，跳过。`)
        return ''
    }

    let contextText = ''

    try {
        if (mode === 'manual' && docs && docs.length > 0) {
            onLog?.(`正在从知识库提取手动选择的文档内容...`)
            for (const docId of docs) {
                try {
                    const { doc, text } = await knowledgeService.previewDocument(docId)
                    contextText += `\n\n--- 文档：${doc.filename} ---\n${text}`
                } catch (e) {
                    logger.error(moduleName, `读取文档 ${docId} 失败`, String(e))
                }
            }
            if (contextText) {
                logger.info(moduleName, `成功从 ${docs.length} 个手动选择的文档中提取了内容`)
                onLog?.(`✅ 已成功提取 ${docs.length} 篇知识库文档内容`)
            } else {
                logger.warn(moduleName, `手动选择的文档未能成功提取任何内容`)
            }
        } else if (mode === 'auto' && autoQuery) {
            onLog?.(`正在自动检索知识库相关内容...`)
            const settings = systemRepo.getAppSettings()
            const embeddingConfig = systemRepo.resolveEmbeddingConfig(settings)

            const threshold = settings.vectorSearch?.taskSearch?.threshold ?? 0.5
            const topK = settings.vectorSearch?.taskSearch?.topK ?? 5

            const searchResult = await knowledgeService.searchDocuments(
                autoQuery,
                'semantic',
                embeddingConfig,
                threshold,
                topK
            )

            if (searchResult && 'chunks' in searchResult && searchResult.chunks.length > 0) {
                logger.info(moduleName, `自动匹配完成，找到 ${searchResult.chunks.length} 个相关片段`)
                onLog?.(`✅ 从知识库中自动检索到 ${searchResult.chunks.length} 个相关片段`)
                for (let i = 0; i < searchResult.chunks.length; i++) {
                    contextText += `\n\n[参考片段 ${i + 1}]:\n${searchResult.chunks[i].content}`
                }
            } else {
                logger.warn(moduleName, `自动检索完成，但未匹配到相关文档（阈值: ${threshold}, TopK: ${topK}）。Query: ${autoQuery.substring(0, 50)}...`)
                onLog?.(`⚠️ 自动检索暂无相关知识库内容匹配`)
            }
        }
    } catch (e: any) {
        logger.error(moduleName, '构建知识上下文失败', e)
        onLog?.(`⚠️ 获取参考知识失败: ${e.message}`)
    }

    return contextText
}
