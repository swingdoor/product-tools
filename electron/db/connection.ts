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
    knowledgeRefMode TEXT,
    knowledgeRefDocs TEXT,
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
    knowledgeRefMode TEXT,
    knowledgeRefDocs TEXT,
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
    knowledgeRefMode TEXT,
    knowledgeRefDocs TEXT,
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
    knowledgeRefMode TEXT,
    knowledgeRefDocs TEXT,
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
const addColumnsIfNotExist = (tableName: string, cols: Array<{ name: string, type: string }>) => {
  try {
    const columns = db.pragma(`table_info(${tableName})`) as any[]
    for (const col of cols) {
      const exists = columns.find((c: any) => c.name === col.name)
      if (!exists) {
        try {
          db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}`)
          logger.info('DB', `成功添加列: ${tableName}.${col.name}`)
        } catch (alterErr) {
          logger.error('DB', `添加列失败: ${tableName}.${col.name}`, alterErr instanceof Error ? alterErr.message : String(alterErr))
        }
      }
    }
  } catch (e) {
    logger.error('DB', `检查表结构失败: ${tableName}`, e instanceof Error ? e.message : String(e))
  }
}

try {
  const tableColumns = db.pragma('table_info(knowledge_docs)') as any[]
  if (tableColumns.length > 0 && !tableColumns.find((c: any) => c.name === 'tags')) {
    db.exec(`ALTER TABLE knowledge_docs ADD COLUMN tags TEXT DEFAULT '[]'`)
  }
  // 确保旧数据的 NULL 标签也被初始化为 []
  db.exec(`UPDATE knowledge_docs SET tags = '[]' WHERE tags IS NULL`)
} catch (e) { }

addColumnsIfNotExist('market_reports', [
  { name: 'knowledgeRefMode', type: 'TEXT' },
  { name: 'knowledgeRefDocs', type: 'TEXT' }
])
addColumnsIfNotExist('analysis_tasks', [
  { name: 'knowledgeRefMode', type: 'TEXT' },
  { name: 'knowledgeRefDocs', type: 'TEXT' }
])
addColumnsIfNotExist('prototype_projects', [
  { name: 'knowledgeRefMode', type: 'TEXT' },
  { name: 'knowledgeRefDocs', type: 'TEXT' }
])
addColumnsIfNotExist('design_docs', [
  { name: 'knowledgeRefMode', type: 'TEXT' },
  { name: 'knowledgeRefDocs', type: 'TEXT' }
])

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

try {
  const analysisCols = db.pragma('table_info(analysis_tasks)') as any[];
  logger.info('DB_DEBUG', 'Analysis_tasks cols:', analysisCols.map(c => c.name).join(', '));
  const projectCols = db.pragma('table_info(prototype_projects)') as any[];
  logger.info('DB_DEBUG', 'Prototype_projects cols:', projectCols.map(c => c.name).join(', '));
} catch (e) {
  logger.error('DB_DEBUG', 'Failed to get table info', e instanceof Error ? e.message : String(e));
}

export { db, dbPath }
