import { db, toDB, fromDB } from '../connection'

export interface KnowledgeDoc {
    id: string
    filename: string
    type: string
    size: number
    path: string
    tags: string  // JSON string array e.g. '["tag1","tag2"]'
    createdAt: string
}

export interface KnowledgeVector {
    id: string
    docId: string
    chunkIndex: number
    content: string
    vector: number[] // 内存中为数组，数据库中为 JSON 字符串
    createdAt: string
}

class KnowledgeRepository {
    // ── 文档表操作 ──

    insertDoc(doc: KnowledgeDoc) {
        const stmt = db.prepare(`
      INSERT INTO knowledge_docs (id, filename, type, size, path, tags, createdAt)
      VALUES (@id, @filename, @type, @size, @path, @tags, @createdAt)
    `)
        stmt.run({ ...doc, tags: doc.tags || '[]' })
    }

    getDoc(id: string): KnowledgeDoc | undefined {
        return db.prepare('SELECT * FROM knowledge_docs WHERE id = ?').get(id) as KnowledgeDoc | undefined
    }

    getAllDocs(): KnowledgeDoc[] {
        return db.prepare('SELECT * FROM knowledge_docs ORDER BY createdAt DESC').all() as KnowledgeDoc[]
    }

    searchDocs(keyword: string): KnowledgeDoc[] {
        return db.prepare('SELECT * FROM knowledge_docs WHERE filename LIKE ? ORDER BY createdAt DESC').all(`%${keyword}%`) as KnowledgeDoc[]
    }

    deleteDoc(id: string) {
        db.prepare('DELETE FROM knowledge_docs WHERE id = ?').run(id)
    }

    updateTags(id: string, tags: string[]) {
        db.prepare('UPDATE knowledge_docs SET tags = ? WHERE id = ?').run(JSON.stringify(tags), id)
    }

    searchByTag(tag: string): KnowledgeDoc[] {
        const allDocs = this.getAllDocs()
        return allDocs.filter(d => {
            try {
                const tags: string[] = JSON.parse(d.tags || '[]')
                return tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
            } catch { return false }
        })
    }

    deleteTagGlobally(tagToDelete: string) {
        const allDocs = this.getAllDocs()
        for (const doc of allDocs) {
            try {
                let tags: string[] = JSON.parse(doc.tags || '[]')
                if (tags.includes(tagToDelete)) {
                    tags = tags.filter(t => t !== tagToDelete)
                    this.updateTags(doc.id, tags)
                }
            } catch (e) {
                console.error(`Failed to parse tags for doc ${doc.id}`, e)
            }
        }
    }

    // ── 向量表操作 ──

    insertVector(vectorInfo: Omit<KnowledgeVector, 'vector'> & { vector: number[] }) {
        const stmt = db.prepare(`
      INSERT INTO knowledge_vectors (id, docId, chunkIndex, content, vector, createdAt)
      VALUES (@id, @docId, @chunkIndex, @content, @vector, @createdAt)
    `)
        stmt.run({
            ...vectorInfo,
            vector: toDB(vectorInfo.vector)
        })
    }

    getVectorsByDocId(docId: string): (Omit<KnowledgeVector, 'vector'> & { vector: number[] })[] {
        const rows = db.prepare('SELECT * FROM knowledge_vectors WHERE docId = ? ORDER BY chunkIndex ASC').all(docId) as any[]
        return rows.map(row => ({
            ...row,
            vector: fromDB<number[]>(row.vector) || []
        }))
    }

    deleteVectorsByDocId(docId: string) {
        db.prepare('DELETE FROM knowledge_vectors WHERE docId = ?').run(docId)
    }

    /**
     * 获取全量向量，用于在内存中计算相似度（对于知识库规模不大时适用）
     */
    getAllVectors(): (Omit<KnowledgeVector, 'vector'> & { vector: number[] })[] {
        const rows = db.prepare('SELECT * FROM knowledge_vectors').all() as any[]
        return rows.map(row => ({
            ...row,
            vector: fromDB<number[]>(row.vector) || []
        }))
    }
}

export const knowledgeRepo = new KnowledgeRepository()
