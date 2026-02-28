import { db, toDB, fromDB } from '../connection'
import { PrototypeProject, PrototypeData, PrototypeVersion, GenerateProgress, TaskStatus } from '../../../src/electron.d'

export const projectRepo = {
    getAll(): PrototypeProject[] {
        const rows = db.prepare('SELECT * FROM prototype_projects ORDER BY createdAt DESC').all() as any[]
        return rows.map(row => ({
            ...row,
            data: fromDB<PrototypeData>(row.data),
            versions: fromDB<PrototypeVersion[]>(row.versions) || [],
            progress: fromDB<GenerateProgress>(row.progress)
        }))
    },

    getById(id: string): PrototypeProject | undefined {
        const row = db.prepare('SELECT * FROM prototype_projects WHERE id = ?').get(id) as any
        if (!row) return undefined
        return {
            ...row,
            data: fromDB<PrototypeData>(row.data),
            versions: fromDB<PrototypeVersion[]>(row.versions) || [],
            progress: fromDB<GenerateProgress>(row.progress)
        }
    },

    save(project: PrototypeProject): PrototypeProject {
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO prototype_projects (
        id, title, status, clientType, sourceAnalysisId, analysisContent, data, versions, createdAt, updatedAt, errorMessage, progress
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        stmt.run(
            project.id,
            project.title,
            project.status,
            project.clientType,
            project.sourceAnalysisId,
            project.analysisContent,
            toDB(project.data),
            toDB(project.versions),
            project.createdAt,
            project.updatedAt,
            project.errorMessage || null,
            toDB(project.progress)
        )
        return project
    },

    delete(id: string): boolean {
        const result = db.prepare('DELETE FROM prototype_projects WHERE id = ?').run(id)
        return result.changes > 0
    },

    clearAll(): void {
        db.prepare('DELETE FROM prototype_projects').run()
    }
}
