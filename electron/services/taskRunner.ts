import { getProjects, updateProjectStatusAndProgress, addLog } from '../store'
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
                this.markTaskAsFailed(project.id, '后台任务异常中断（无心跳记录）')
                continue
            }

            const elapsed = Date.now() - new Date(lastHeartbeat).getTime()
            if (elapsed > HEARTBEAT_TIMEOUT_MS) {
                const timeoutSec = Math.floor(elapsed / 1000)
                this.markTaskAsFailed(project.id, `后台任务已超时 ${timeoutSec} 秒无响应，判定为失败`)
            }
        }
    }

    private markTaskAsFailed(projectId: string, reason: string) {
        logger.warn('TaskManager', `任务超时: ${projectId} | 原因: ${reason}`)
        updateProjectStatusAndProgress(projectId, 'failed', { step: 'error', errorMessage: reason }, reason)
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
