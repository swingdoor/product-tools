import { db, toDB, fromDB } from '../connection'
import { AnalysisTask, AnalysisProgress, TaskStatus } from '../../../src/electron.d'

export const analysisRepo = {
    getAll(): AnalysisTask[] {
        const rows = db.prepare('SELECT * FROM analysis_tasks ORDER BY createdAt DESC').all() as any[]
        return rows.map(row => ({
            ...row,
            knowledgeRefDocs: row.knowledgeRefDocs ? fromDB<string[]>(row.knowledgeRefDocs) : undefined,
            progress: fromDB<AnalysisProgress>(row.progress)
        }))
    },

    getById(id: string): AnalysisTask | undefined {
        const row = db.prepare('SELECT * FROM analysis_tasks WHERE id = ?').get(id) as any
        if (!row) return undefined
        return {
            ...row,
            knowledgeRefDocs: row.knowledgeRefDocs ? fromDB<string[]>(row.knowledgeRefDocs) : undefined,
            progress: fromDB<AnalysisProgress>(row.progress)
        }
    },

    save(task: AnalysisTask): AnalysisTask {
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO analysis_tasks (
        id, title, status, sourceReportId, sourceReportTitle, inputContent, resultContent, knowledgeRefMode, knowledgeRefDocs, createdAt, updatedAt, errorMessage, progress
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        stmt.run(
            task.id,
            task.title,
            task.status,
            task.sourceReportId || null,
            task.sourceReportTitle || null,
            task.inputContent,
            task.resultContent || null,
            task.knowledgeRefMode || null,
            toDB(task.knowledgeRefDocs),
            task.createdAt,
            task.updatedAt,
            task.errorMessage || null,
            toDB(task.progress)
        )
        return task
    },

    delete(id: string): boolean {
        const result = db.prepare('DELETE FROM analysis_tasks WHERE id = ?').run(id)
        return result.changes > 0
    },

    clearAll(): void {
        db.prepare('DELETE FROM analysis_tasks').run()
    }
}
