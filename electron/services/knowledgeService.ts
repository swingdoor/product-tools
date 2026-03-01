import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
// 关键修复：直接引用 lib 下的代码，避开 index.js 中会导致打包后崩溃的测试代码 (ENOENT)
const pdfParse = require('pdf-parse/lib/pdf-parse.js')
import mammoth from 'mammoth'
import { knowledgeRepo, KnowledgeDoc } from '../db/repositories/knowledgeRepo'
import { getEmbedding } from './ai'
import { logger } from '../logger'

// 常量定义
const CHUNK_SIZE = 800
const CHUNK_OVERLAP = 100

// 辅助函数：分块
function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    const result: string[] = []
    let startIndex = 0
    while (startIndex < text.length) {
        const chunk = text.slice(startIndex, startIndex + chunkSize)
        result.push(chunk)
        startIndex += chunkSize - overlap
    }
    return result
}

// 余弦相似度计算
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0
    let dotProduct = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i]
        normA += vecA[i] * vecA[i]
        normB += vecB[i] * vecB[i]
    }
    if (normA === 0 || normB === 0) return 0
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

class KnowledgeService {
    private getStorageDir() {
        const dir = path.join(app.getPath('userData'), 'knowledge')
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
        return dir
    }

    // 将数据库存储的路径解析为绝对路径
    // 兼容旧版（绝对路径）和新版（相对文件名）
    private resolveDocPath(storedPath: string): string {
        if (path.isAbsolute(storedPath)) {
            return storedPath  // 旧版绝对路径，直接使用
        }
        return path.join(this.getStorageDir(), storedPath)
    }

    // 给文档对象附上绝对路径（供前端使用）
    private enrichDoc(doc: KnowledgeDoc) {
        return { ...doc, fullPath: this.resolveDocPath(doc.path) }
    }

    // 1. 获取文档列表
    getDocuments() {
        return knowledgeRepo.getAllDocs().map(d => this.enrichDoc(d))
    }

    // 2. 上传并处理文档（文件保存不受文本提取影响）
    async uploadDocument(
        sourcePath: string,
        filename: string,
        type: string,
        size: number,
        embeddingConfig: { apiKey: string; baseUrl: string; model: string }
    ) {
        const docId = `kdoc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        const storageDir = this.getStorageDir()
        // 存储的文件名（相对路径）
        const storedFilename = `${docId}_${filename}`
        const targetPath = path.join(storageDir, storedFilename)

        // 1) 复制文件到本地目录
        fs.copyFileSync(sourcePath, targetPath)

        // 2) 创建文档记录（数据库中只存相对文件名，不存绝对路径）
        const doc: KnowledgeDoc = {
            id: docId,
            filename,
            type,
            size,
            path: storedFilename,  // 相对路径
            tags: '[]',
            createdAt: new Date().toISOString()
        }
        knowledgeRepo.insertDoc(doc)
        logger.info('Knowledge', `文档已保存: ${filename}`)

        // 3) 尝试提取文本并向量化（失败不影响文件上传）
        try {
            let text = ''
            const ext = path.extname(filename).toLowerCase()

            if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(targetPath)
                const pdfData = await pdfParse(dataBuffer)
                text = pdfData.text
            } else if (ext === '.docx' || ext === '.doc') {
                const result = await mammoth.extractRawText({ path: targetPath })
                text = result.value
            } else if (ext === '.txt' || ext === '.md') {
                text = fs.readFileSync(targetPath, 'utf8')
            }

            if (text.trim()) {
                const chunks = splitTextIntoChunks(text, CHUNK_SIZE, CHUNK_OVERLAP)
                for (let i = 0; i < chunks.length; i++) {
                    const chunkText = chunks[i].trim()
                    if (!chunkText) continue
                    const vector = await getEmbedding(
                        chunkText,
                        embeddingConfig.apiKey,
                        embeddingConfig.baseUrl,
                        embeddingConfig.model
                    )
                    knowledgeRepo.insertVector({
                        id: uuidv4(),
                        docId,
                        chunkIndex: i,
                        content: chunkText,
                        vector,
                        createdAt: new Date().toISOString()
                    })
                }
                logger.info('Knowledge', `文档向量化完成: ${filename}, ${chunks.length} 个分块`)
            } else {
                logger.warn('Knowledge', `未从文档中提取到文本: ${filename}`)
            }
        } catch (e: any) {
            logger.error('Knowledge', '文本提取或向量化失败（文档已保存）', e instanceof Error ? e.message : String(e))
        }

        return this.enrichDoc(doc)
    }

    // 3. 删除文档
    deleteDocument(docId: string) {
        const doc = knowledgeRepo.getDoc(docId)
        if (doc) {
            const fullPath = this.resolveDocPath(doc.path)
            if (fs.existsSync(fullPath)) {
                try {
                    fs.unlinkSync(fullPath)
                } catch (e: any) {
                    logger.error('Knowledge', '删除文档文件失败', e instanceof Error ? e.message : String(e))
                }
            }
        }
        knowledgeRepo.deleteDoc(docId)
        knowledgeRepo.deleteVectorsByDocId(docId)
    }

    // 3.5 更新标签
    updateTags(docId: string, tags: string[]) {
        knowledgeRepo.updateTags(docId, tags)
    }

    deleteGlobalTag(tag: string) {
        knowledgeRepo.deleteTagGlobally(tag)
    }

    // 4. 预览文档 (返回完整文本和HTML内容)
    async previewDocument(docId: string) {
        const doc = knowledgeRepo.getDoc(docId)
        if (!doc) throw new Error('文档不存在')
        const fullPath = this.resolveDocPath(doc.path)
        if (!fs.existsSync(fullPath)) throw new Error('文件不存在或已被删除')

        const ext = path.extname(doc.filename).toLowerCase()
        let text = ''
        let html = ''
        try {
            if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(fullPath)
                const pdfData = await pdfParse(dataBuffer)
                text = pdfData.text
            } else if (ext === '.docx' || ext === '.doc') {
                const textResult = await mammoth.extractRawText({ path: fullPath })
                text = textResult.value
                const htmlResult = await mammoth.convertToHtml({ path: fullPath })
                html = htmlResult.value
            } else if (ext === '.md') {
                text = fs.readFileSync(fullPath, 'utf8')
            } else if (ext === '.txt') {
                text = fs.readFileSync(fullPath, 'utf8')
            }
        } catch (e: any) {
            logger.error('Knowledge', '预览文档失败', e instanceof Error ? e.message : String(e))
            throw new Error('预览失败或文件已损坏')
        }

        // 返回时附上绝对路径供前端使用
        return { doc: this.enrichDoc(doc), text, html, ext }
    }

    // 5. 语义检索与普通检索
    async searchDocuments(
        query: string,
        type: 'semantic' | 'keyword',
        embeddingConfig?: { apiKey: string; baseUrl: string; model: string },
        threshold: number = 0.3,
        topK: number = 10
    ) {
        if (type === 'keyword') {
            return knowledgeRepo.searchDocs(query)
        }

        if (type === 'semantic' && embeddingConfig) {
            const queryVector = await getEmbedding(
                query,
                embeddingConfig.apiKey,
                embeddingConfig.baseUrl,
                embeddingConfig.model
            )

            const allVectors = knowledgeRepo.getAllVectors()

            let scoredChunks = allVectors.map(v => ({
                ...v,
                score: cosineSimilarity(queryVector, v.vector)
            }))

            // 过滤低于阈值的结果
            if (threshold > 0) {
                scoredChunks = scoredChunks.filter(c => c.score >= threshold)
            }

            // 按相似度降序
            scoredChunks.sort((a, b) => b.score - a.score)
            const topChunks = scoredChunks.slice(0, topK) // 取Top K结果

            // 提取唯一的文档Id并查询对应文档
            const docIds = Array.from(new Set(topChunks.map(c => c.docId)))
            const matchedDocs = docIds.map(id => knowledgeRepo.getDoc(id)).filter(Boolean) as KnowledgeDoc[]

            return {
                docs: matchedDocs,
                chunks: topChunks.map(c => ({
                    docId: c.docId,
                    content: c.content,
                    score: c.score
                }))
            }
        }

        return []
    }
}

export const knowledgeService = new KnowledgeService()
