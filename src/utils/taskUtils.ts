export type TaskStatus = 'pending' | 'generating' | 'completed' | 'failed'

/**
 * 获取状态对应的 Element Plus tag 类型
 */
export function getStatusType(status: TaskStatus): 'info' | 'warning' | 'success' | 'danger' {
    const map: Record<TaskStatus, 'info' | 'warning' | 'success' | 'danger'> = {
        pending: 'info',
        generating: 'warning',
        completed: 'success',
        failed: 'danger'
    }
    return map[status] || 'info'
}

/**
 * 获取状态的中文文本显示
 */
export function getStatusText(status: TaskStatus, type: 'market' | 'analysis' | 'prototype' | 'design' = 'market'): string {
    if (type === 'analysis') {
        const map = { pending: '待分析', generating: '执行中', completed: '已完成', failed: '失败' }
        return map[status] || status
    }

    const map = { pending: '待提交', generating: '执行中', completed: '已完成', failed: '失败' }
    return map[status] || status
}
