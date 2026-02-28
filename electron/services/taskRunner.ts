import { getProjects, updateProjectStatusAndProgress, addLog, getMarketReports, getAnalysisTasks, getDesignDocs, updateMarketReportStatus, updateAnalysisTaskStatus, updateDesignDocStatus } from '../store'
import { logger } from '../logger'

// 心跳间隔（5秒）
export const HEARTBEAT_INTERVAL_MS = 5 * 1000
// 心跳超时时间（30秒）
export const HEARTBEAT_TIMEOUT_MS = 30 * 1000
// 任务管理器检查间隔（5秒）
export const TASK_CHECK_INTERVAL_MS = 5 * 1000

/** 任务状态 */
export interface TaskState {
    projectId: string
    cancelled: boolean
    startTime: number
}

/** 任务管理器：管理所有运行中的任务，统一检测心跳超时 */
export class TaskManager {
    private runningTasks = new Map<string, TaskState>()
    private checkTimer: ReturnType<typeof setInterval> | null = null

    constructor() {
        this.startHeartbeatChecker()
    }

    private startHeartbeatChecker() {
        if (this.checkTimer) return
        this.checkTimer = setInterval(() => this.checkAllTasksHeartbeat(), TASK_CHECK_INTERVAL_MS)
        logger.info('TaskManager', '心跳检查器已启动')
    }

    private checkAllTasksHeartbeat() {
        const projects = getProjects()
        const generatingProjects = projects.filter(p => p.status === 'generating')

        for (const project of generatingProjects) {
            const taskState = this.runningTasks.get(project.id)

            if (taskState && !taskState.cancelled) {
                continue
            }

            const lastHeartbeat = project.progress?.lastHeartbeat
            if (!lastHeartbeat) {
                this.markTaskAsFailed(project.id, 'prototype', '后台任务异常中断（无心跳记录）')
                continue
            }

            const elapsed = Date.now() - new Date(lastHeartbeat).getTime()
            if (elapsed > HEARTBEAT_TIMEOUT_MS) {
                const timeoutSec = Math.floor(elapsed / 1000)
                this.markTaskAsFailed(project.id, 'prototype', `后台任务已超时 ${timeoutSec} 秒无响应，判定为失败`)
            }
        }

        // 检查市场报告
        const marketReports = getMarketReports()
        const generatingMarketReports = marketReports.filter(p => p.status === 'generating')
        for (const report of generatingMarketReports) {
            const taskState = this.runningTasks.get(report.id)
            if (taskState && !taskState.cancelled) continue

            const lastHeartbeat = report.progress?.lastHeartbeat
            if (!lastHeartbeat) {
                this.markTaskAsFailed(report.id, 'market', '后台任务异常中断（无心跳记录）')
                continue
            }
            const elapsed = Date.now() - new Date(lastHeartbeat).getTime()
            if (elapsed > HEARTBEAT_TIMEOUT_MS) {
                const timeoutSec = Math.floor(elapsed / 1000)
                this.markTaskAsFailed(report.id, 'market', `后台任务已超时 ${timeoutSec} 秒无响应，判定为失败`)
            }
        }

        // 检查分析任务
        const analysisTasks = getAnalysisTasks()
        const generatingAnalysisTasks = analysisTasks.filter(p => p.status === 'generating')
        for (const task of generatingAnalysisTasks) {
            const taskState = this.runningTasks.get(task.id)
            if (taskState && !taskState.cancelled) continue

            const lastHeartbeat = task.progress?.lastHeartbeat
            if (!lastHeartbeat) {
                this.markTaskAsFailed(task.id, 'analysis', '后台任务异常中断（无心跳记录）')
                continue
            }
            const elapsed = Date.now() - new Date(lastHeartbeat).getTime()
            if (elapsed > HEARTBEAT_TIMEOUT_MS) {
                const timeoutSec = Math.floor(elapsed / 1000)
                this.markTaskAsFailed(task.id, 'analysis', `后台任务已超时 ${timeoutSec} 秒无响应，判定为失败`)
            }
        }

        // 检查设计文档
        const designDocs = getDesignDocs()
        const generatingDesignDocs = designDocs.filter(p => p.status === 'generating')
        for (const doc of generatingDesignDocs) {
            const taskState = this.runningTasks.get(doc.id)
            if (taskState && !taskState.cancelled) continue

            const lastHeartbeat = doc.progress?.lastHeartbeat
            if (!lastHeartbeat) {
                this.markTaskAsFailed(doc.id, 'design', '后台任务异常中断（无心跳记录）')
                continue
            }
            const elapsed = Date.now() - new Date(lastHeartbeat).getTime()
            if (elapsed > HEARTBEAT_TIMEOUT_MS) {
                const timeoutSec = Math.floor(elapsed / 1000)
                this.markTaskAsFailed(doc.id, 'design', `后台任务已超时 ${timeoutSec} 秒无响应，判定为失败`)
            }
        }
    }

    private markTaskAsFailed(projectId: string, type: 'prototype' | 'market' | 'analysis' | 'design', reason: string) {
        logger.warn('TaskManager', `任务超时: ${projectId} [${type}] | 原因: ${reason}`)
        if (type === 'prototype') {
            updateProjectStatusAndProgress(projectId, 'failed', { step: 'error', errorMessage: reason }, reason)
        } else if (type === 'market') {
            updateMarketReportStatus(projectId, 'failed', { errorMessage: reason })
        } else if (type === 'analysis') {
            updateAnalysisTaskStatus(projectId, 'failed', { errorMessage: reason })
        } else if (type === 'design') {
            updateDesignDocStatus(projectId, 'failed', { errorMessage: reason })
        }
        addLog({ taskId: projectId, type: 'error', message: reason, timestamp: new Date().toISOString() })
        this.runningTasks.delete(projectId)
    }

    registerTask(projectId: string): TaskState {
        const state: TaskState = {
            projectId,
            cancelled: false,
            startTime: Date.now()
        }
        this.runningTasks.set(projectId, state)
        return state
    }

    cancelTask(projectId: string): boolean {
        const state = this.runningTasks.get(projectId)
        if (state) {
            state.cancelled = true
            this.runningTasks.delete(projectId)
            return true
        }
        return false
    }

    unregisterTask(projectId: string) {
        this.runningTasks.delete(projectId)
    }

    isTaskRunning(projectId: string): boolean {
        const state = this.runningTasks.get(projectId)
        return state ? !state.cancelled : false
    }
}

// 导出全局单例
export const taskManager = new TaskManager()
