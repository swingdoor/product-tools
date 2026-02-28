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

  CREATE INDEX IF NOT EXISTS idx_logs_taskId ON task_logs(taskId);
`)

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
