import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { logger } from '../logger'
import Store from 'electron-store'

// ────────────────────────────────────────────────────────────
// SQLite 数据库初始化
// ────────────────────────────────────────────────────────────

const dbPath = path.join(app.getPath('userData'), 'product_tools.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

// 创建表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS market_reports (
    id TEXT PRIMARY KEY,
    title TEXT,
    status TEXT,
    industry TEXT,
    targetUsers TEXT,
    focusAreas TEXT, -- JSON array
    dataSources TEXT,
    deepSearch INTEGER, -- Boolean
    resultContent TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    errorMessage TEXT,
    progress TEXT -- JSON object
  );

  CREATE TABLE IF NOT EXISTS analysis_tasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    status TEXT,
    sourceReportId TEXT,
    sourceReportTitle TEXT,
    inputContent TEXT,
    resultContent TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    errorMessage TEXT,
    progress TEXT -- JSON object
  );

  CREATE TABLE IF NOT EXISTS prototype_projects (
    id TEXT PRIMARY KEY,
    title TEXT,
    status TEXT,
    clientType TEXT,
    sourceAnalysisId TEXT,
    analysisContent TEXT,
    data TEXT, -- JSON object (PrototypeData)
    versions TEXT, -- JSON array (PrototypeVersion[])
    createdAt TEXT,
    updatedAt TEXT,
    errorMessage TEXT,
    progress TEXT -- JSON object (GenerateProgress)
  );

  CREATE TABLE IF NOT EXISTS design_docs (
    id TEXT PRIMARY KEY,
    title TEXT,
    status TEXT,
    sourceProjectId TEXT,
    sourceProjectTitle TEXT,
    pageCount INTEGER,
    resultContent TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    errorMessage TEXT,
    progress TEXT -- JSON object
  );

  CREATE TABLE IF NOT EXISTS task_logs (
    id TEXT PRIMARY KEY,
    taskId TEXT,
    type TEXT,
    message TEXT,
    detail TEXT,
    timestamp TEXT
  );
  
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT -- JSON string
  );

  CREATE TABLE IF NOT EXISTS knowledge_docs (
    id TEXT PRIMARY KEY,
    filename TEXT,
    type TEXT,
    size INTEGER,
    path TEXT,
    tags TEXT DEFAULT '[]',
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS knowledge_vectors (
    id TEXT PRIMARY KEY,
    docId TEXT,
    chunkIndex INTEGER,
    content TEXT,
    vector TEXT, -- JSON array of floats
    createdAt TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_logs_taskId ON task_logs(taskId);
  CREATE INDEX IF NOT EXISTS idx_vectors_docId ON knowledge_vectors(docId);
`)

// ── 数据库迁移：为已有表添加新字段 ──
try {
  // 检查 knowledge_docs 表是否已有 tags 字段
  const columns = db.pragma('table_info(knowledge_docs)') as any[]
  if (columns.length > 0 && !columns.find((c: any) => c.name === 'tags')) {
    db.exec(`ALTER TABLE knowledge_docs ADD COLUMN tags TEXT DEFAULT '[]'`)
  }
} catch (e) {
  // 表可能不存在，忽略
}

// ────────────────────────────────────────────────────────────
// 辅助方法：处理 JSON 转换
// ────────────────────────────────────────────────────────────

export function toDB(val: any) {
  return val ? JSON.stringify(val) : null
}

export function fromDB<T>(val: any): T | null {
  if (!val) return null
  try {
    return JSON.parse(val) as T
  } catch (e) {
    return null
  }
}

export { db, dbPath }
