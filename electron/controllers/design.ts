import { designDocService } from '../services/designDocService'
import { systemRepo } from '../db/repositories/systemRepo'
import { generatePageDesignWithHeartbeat } from '../services/ai'
import type { TaskState } from '../services/taskRunner'
import type { DesignDoc } from '../../src/electron.d'
import type { PrototypeProject } from '../../src/electron.d'
import { logger } from '../logger'

/** 执行设计文档生成任务 */
export async function executeDesignDocTask(
    docId: string,
    doc: DesignDoc,
    project: PrototypeProject,
    apiKey: string,
    baseUrl: string,
    model: string | undefined,
    taskState: TaskState,
    prompts?: Record<string, string>
) {
    const moduleName = 'DesignDoc'
    logger.info(moduleName, `开始执行设计文档任务 | ID: ${docId}`)
    const pages = project.data?.pages || []
    const totalPages = pages.length
    let resultContent = `# ${doc.title}\n\n> 基于原型项目「${project.title}」自动生成\n> 生成时间：${new Date().toISOString().replace('T', ' ').slice(0, 19)}\n\n---\n\n`

    try {
        for (let i = 0; i < totalPages; i++) {
            if (taskState.cancelled) return

            const page = pages[i]
            const currentPage = i + 1
            const percentage = Math.round((i / totalPages) * 100)

            // 更新进度
            designDocService.updateProgress(docId, {
                totalPages,
                currentPage,
                currentPageName: page.name,
                percentage,
                lastHeartbeat: new Date().toISOString()
            })

            systemRepo.addLog({
                taskId: docId,
                type: 'generate_step',
                message: `正在生成页面 ${currentPage}/${totalPages}: ${page.name}`,
                timestamp: new Date().toISOString()
            })

            // 生成单个页面的设计说明
            const pageDesign = await generatePageDesignWithHeartbeat(
                page, apiKey, baseUrl, model, docId, taskState, prompts?.['design-doc']
            )

            if (taskState.cancelled) return

            // 汇总到结果中
            resultContent += `## ${currentPage}. ${page.name}\n\n`
            resultContent += pageDesign
            resultContent += '\n\n---\n\n'
        }

        if (taskState.cancelled) return

        // 保存结果
        designDocService.updateStatus(docId, 'completed', {
            resultContent,
            progress: {
                totalPages,
                currentPage: totalPages,
                currentPageName: '',
                percentage: 100,
                lastHeartbeat: new Date().toISOString()
            }
        })

        systemRepo.addLog({ taskId: docId, type: 'generate_done', message: '设计文档生成完成', timestamp: new Date().toISOString() })
        logger.info(moduleName, `设计文档任务完成 | ID: ${docId}`)

    } catch (err) {
        if (taskState.cancelled) return
        const errMsg = err instanceof Error ? err.message : '生成失败，请重试'
        designDocService.updateStatus(docId, 'failed', { errorMessage: errMsg })
        systemRepo.addLog({ taskId: docId, type: 'error', message: `生成失败: ${errMsg}`, timestamp: new Date().toISOString() })
        logger.error(moduleName, `设计文档生成失败: ${errMsg} | ID: ${docId}`)
    }
}
