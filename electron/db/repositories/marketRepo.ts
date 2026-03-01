import { db, toDB, fromDB } from '../connection'
import { MarketReport, MarketProgress, TaskStatus } from '../../../src/electron.d'

export const marketRepo = {
    getAll(): MarketReport[] {
        const rows = db.prepare('SELECT * FROM market_reports ORDER BY createdAt DESC').all() as any[]
        return rows.map(row => ({
            ...row,
            knowledgeRefDocs: row.knowledgeRefDocs ? fromDB<string[]>(row.knowledgeRefDocs) : undefined,
            deepSearch: !!row.deepSearch,
            focusAreas: fromDB<string[]>(row.focusAreas) || [],
            progress: fromDB<MarketProgress>(row.progress)
        }))
    },

    getById(id: string): MarketReport | undefined {
        const row = db.prepare('SELECT * FROM market_reports WHERE id = ?').get(id) as any
        if (!row) return undefined
        return {
            ...row,
            knowledgeRefDocs: row.knowledgeRefDocs ? fromDB<string[]>(row.knowledgeRefDocs) : undefined,
            deepSearch: !!row.deepSearch,
            focusAreas: fromDB<string[]>(row.focusAreas) || [],
            progress: fromDB<MarketProgress>(row.progress)
        }
    },

    save(report: MarketReport): MarketReport {
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO market_reports (
        id, title, status, industry, targetUsers, focusAreas, dataSources, deepSearch, resultContent, knowledgeRefMode, knowledgeRefDocs, createdAt, updatedAt, errorMessage, progress
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        stmt.run(
            report.id,
            report.title,
            report.status,
            report.industry,
            report.targetUsers,
            toDB(report.focusAreas),
            report.dataSources,
            report.deepSearch ? 1 : 0,
            report.resultContent || null,
            report.knowledgeRefMode || null,
            toDB(report.knowledgeRefDocs),
            report.createdAt,
            report.updatedAt,
            report.errorMessage || null,
            toDB(report.progress)
        )
        return report
    },

    delete(id: string): boolean {
        const result = db.prepare('DELETE FROM market_reports WHERE id = ?').run(id)
        return result.changes > 0
    },

    clearAll(): void {
        db.prepare('DELETE FROM market_reports').run()
    }
}
