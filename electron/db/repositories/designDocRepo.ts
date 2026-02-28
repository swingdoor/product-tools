import { db, toDB, fromDB } from '../connection'
import { DesignDoc, DesignDocProgress, TaskStatus } from '../../../src/electron.d'

export const designDocRepo = {
    getAll(): DesignDoc[] {
        const rows = db.prepare('SELECT * FROM design_docs ORDER BY createdAt DESC').all() as any[]
        return rows.map(row => ({
            ...row,
            progress: fromDB<DesignDocProgress>(row.progress)
        }))
    },

    getById(id: string): DesignDoc | undefined {
        const row = db.prepare('SELECT * FROM design_docs WHERE id = ?').get(id) as any
        if (!row) return undefined
        return {
            ...row,
            progress: fromDB<DesignDocProgress>(row.progress)
        }
    },

    save(doc: DesignDoc): DesignDoc {
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO design_docs (
        id, title, status, sourceProjectId, sourceProjectTitle, pageCount, resultContent, createdAt, updatedAt, errorMessage, progress
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        stmt.run(
            doc.id,
            doc.title,
            doc.status,
            doc.sourceProjectId,
            doc.sourceProjectTitle,
            doc.pageCount,
            doc.resultContent || null,
            doc.createdAt,
            doc.updatedAt,
            doc.errorMessage || null,
            toDB(doc.progress)
        )
        return doc
    },

    delete(id: string): boolean {
        const result = db.prepare('DELETE FROM design_docs WHERE id = ?').run(id)
        return result.changes > 0
    },

    clearAll(): void {
        db.prepare('DELETE FROM design_docs').run()
    }
}
