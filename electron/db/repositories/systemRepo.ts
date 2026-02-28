import { db, toDB, fromDB } from '../connection'
import { TaskLog } from '../../../src/electron.d'

// ────────────────────────────────────────────────────────────
// 配置持久化 Store (SQLite)
// ────────────────────────────────────────────────────────────

interface ConfigSchema {
    settings: {
        apiKey: string
        baseUrl: string
        model: string
        prompts: Record<string, string>
        searchConfig: {
            enabled: boolean
            sources: string[]
            bochaApiKey: string
        }
    }
}

const DEFAULT_SETTINGS: ConfigSchema['settings'] = {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-reasoner',
    prompts: {},
    searchConfig: { enabled: false, sources: ['bing_cn'], bochaApiKey: '' }
}

export const systemRepo = {
    // 日志操作
    getLogs(): TaskLog[] {
        return db.prepare('SELECT * FROM task_logs ORDER BY timestamp DESC').all() as any[]
    },

    getLogsByTaskId(taskId: string): TaskLog[] {
        return db.prepare('SELECT * FROM task_logs WHERE taskId = ? ORDER BY timestamp DESC').all(taskId) as any[]
    },

    addLog(log: Omit<TaskLog, 'id'>): TaskLog {
        const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const newLog: TaskLog = { ...log, id }

        const stmt = db.prepare(`
      INSERT INTO task_logs (id, taskId, type, message, detail, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
        stmt.run(newLog.id, newLog.taskId, newLog.type, newLog.message, newLog.detail || null, newLog.timestamp)

        // 限制日志总数 (简单的物理删除)
        const count = db.prepare('SELECT COUNT(*) as count FROM task_logs').get() as { count: number }
        if (count.count > 2000) {
            db.prepare(`DELETE FROM task_logs WHERE id IN (SELECT id FROM task_logs ORDER BY timestamp ASC LIMIT ?)`).run(count.count - 2000)
        }

        return newLog
    },

    clearLogsByTaskId(taskId: string): void {
        db.prepare('DELETE FROM task_logs WHERE taskId = ?').run(taskId)
    },

    clearAllLogs(): void {
        db.prepare('DELETE FROM task_logs').run()
    },

    cleanOrphanLogs(): void {
        db.prepare(`
      DELETE FROM task_logs WHERE taskId NOT IN (SELECT id FROM market_reports) 
      AND taskId NOT IN (SELECT id FROM analysis_tasks) 
      AND taskId NOT IN (SELECT id FROM prototype_projects) 
      AND taskId NOT IN (SELECT id FROM design_docs)
    `).run()
    },

    // 设定操作
    getAppSettings(): ConfigSchema['settings'] {
        const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('current_settings') as { value: string } | undefined
        if (!row) {
            return DEFAULT_SETTINGS
        }
        return fromDB<ConfigSchema['settings']>(row.value) || DEFAULT_SETTINGS
    },

    saveAppSettings(settings: any) {
        const stmt = db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)')
        stmt.run('current_settings', toDB(settings))
        return settings
    }
}
