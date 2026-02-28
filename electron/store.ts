import Store from 'electron-store'
import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { logger } from './logger'

// ────────────────────────────────────────────────────────────
// 类型定义 (保持与前端一致)
// ────────────────────────────────────────────────────────────

export type TaskLogType = 'create' | 'status_change' | 'generate_start' | 'generate_step' | 'generate_done' | 'error'
export type TaskStatus = 'pending' | 'generating' | 'completed' | 'failed'
export type GenStep = 'idle' | 'plan' | 'pages' | 'done' | 'error'

export interface TaskLog {
  id: string
  taskId: string
  type: TaskLogType
  message: string
  detail?: string
  timestamp: string
}

export interface PrototypePage {
  id: string
  name: string
  description: string
  prompt: string
  htmlContent: string
}

export interface PrototypeData {
  appName: string
  clientType: string
  pages: PrototypePage[]
}

export interface PrototypeVersion {
  id: string
  data: PrototypeData
  savedAt: string
  description: string
}

export interface GenerateProgress {
  step: GenStep
  totalPages: number
  currentPage: number
  currentPageName: string
  completedPages: { id: string; name: string }[]
  errorMessage?: string
  lastHeartbeat?: string
}

export interface PrototypeProject {
  id: string
  title: string
  status: TaskStatus
  clientType: string
  sourceAnalysisId: string
  analysisContent: string
  data: PrototypeData | null
  versions: PrototypeVersion[]
  createdAt: string
  updatedAt: string
  errorMessage?: string
  progress?: GenerateProgress
}

export interface AnalysisProgress {
  lastHeartbeat?: string
}

export interface AnalysisTask {
  id: string
  title: string
  status: TaskStatus
  sourceReportId?: string
  sourceReportTitle?: string
  inputContent: string
  resultContent?: string
  createdAt: string
  updatedAt: string
  errorMessage?: string
  progress?: AnalysisProgress
}

export interface MarketProgress {
  lastHeartbeat?: string
}

export interface MarketReport {
  id: string
  title: string
  status: TaskStatus
  industry: string
  targetUsers: string
  focusAreas: string[]
  dataSources: string
  deepSearch?: boolean
  resultContent?: string
  createdAt: string
  updatedAt: string
  errorMessage?: string
  progress?: MarketProgress
}

export interface DesignDocProgress {
  totalPages: number
  currentPage: number
  currentPageName: string
  percentage: number
  lastHeartbeat?: string
}

export interface DesignDoc {
  id: string
  title: string
  status: TaskStatus
  sourceProjectId: string
  sourceProjectTitle: string
  pageCount: number
  resultContent?: string
  createdAt: string
  updatedAt: string
  errorMessage?: string
  progress?: DesignDocProgress
}

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

function toDB(val: any) {
  return val ? JSON.stringify(val) : null
}

function fromDB<T>(val: any): T | null {
  if (!val) return null
  try {
    return JSON.parse(val) as T
  } catch (e) {
    return null
  }
}

// ────────────────────────────────────────────────────────────
// 市场报告操作方法
// ────────────────────────────────────────────────────────────

export function getMarketReports(): MarketReport[] {
  const rows = db.prepare('SELECT * FROM market_reports ORDER BY createdAt DESC').all() as any[]
  return rows.map(row => ({
    ...row,
    deepSearch: !!row.deepSearch,
    focusAreas: fromDB<string[]>(row.focusAreas) || [],
    progress: fromDB<MarketProgress>(row.progress)
  }))
}

export function getMarketReportById(id: string): MarketReport | undefined {
  const row = db.prepare('SELECT * FROM market_reports WHERE id = ?').get(id) as any
  if (!row) return undefined
  return {
    ...row,
    deepSearch: !!row.deepSearch,
    focusAreas: fromDB<string[]>(row.focusAreas) || [],
    progress: fromDB<MarketProgress>(row.progress)
  }
}

export function saveMarketReport(report: MarketReport): MarketReport {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO market_reports (
      id, title, status, industry, targetUsers, focusAreas, dataSources, deepSearch, resultContent, createdAt, updatedAt, errorMessage, progress
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    report.createdAt,
    report.updatedAt,
    report.errorMessage || null,
    toDB(report.progress)
  )
  logger.info('Database', `保存市场报告: ${report.id}`, `Status: ${report.status}, ContentLen: ${report.resultContent?.length || 0}`)
  return report
}

export function deleteMarketReport(id: string): boolean {
  const result = db.prepare('DELETE FROM market_reports WHERE id = ?').run(id)
  if (result.changes > 0) {
    db.prepare('DELETE FROM task_logs WHERE taskId = ?').run(id)
    return true
  }
  return false
}

export function updateMarketReportStatus(
  id: string,
  status: TaskStatus,
  updates?: { resultContent?: string; errorMessage?: string; progress?: MarketProgress }
): MarketReport | null {
  const report = getMarketReportById(id)
  if (!report) return null

  report.status = status
  report.updatedAt = new Date().toISOString()

  if (updates?.resultContent !== undefined) report.resultContent = updates.resultContent
  if (updates?.errorMessage !== undefined) report.errorMessage = updates.errorMessage
  if (updates?.progress) report.progress = { ...report.progress, ...updates.progress }

  return saveMarketReport(report)
}

export function updateMarketReportHeartbeat(id: string): MarketReport | null {
  const report = getMarketReportById(id)
  if (!report) return null

  report.progress = {
    ...report.progress,
    lastHeartbeat: new Date().toISOString()
  }
  report.updatedAt = new Date().toISOString()

  return saveMarketReport(report)
}

// ────────────────────────────────────────────────────────────
// 需求分析任务操作方法
// ────────────────────────────────────────────────────────────

export function getAnalysisTasks(): AnalysisTask[] {
  const rows = db.prepare('SELECT * FROM analysis_tasks ORDER BY createdAt DESC').all() as any[]
  return rows.map(row => ({
    ...row,
    progress: fromDB<AnalysisProgress>(row.progress)
  }))
}

export function getAnalysisTaskById(id: string): AnalysisTask | undefined {
  const row = db.prepare('SELECT * FROM analysis_tasks WHERE id = ?').get(id) as any
  if (!row) return undefined
  return {
    ...row,
    progress: fromDB<AnalysisProgress>(row.progress)
  }
}

export function saveAnalysisTask(task: AnalysisTask): AnalysisTask {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO analysis_tasks (
      id, title, status, sourceReportId, sourceReportTitle, inputContent, resultContent, createdAt, updatedAt, errorMessage, progress
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    task.id,
    task.title,
    task.status,
    task.sourceReportId || null,
    task.sourceReportTitle || null,
    task.inputContent,
    task.resultContent || null,
    task.createdAt,
    task.updatedAt,
    task.errorMessage || null,
    toDB(task.progress)
  )
  return task
}

export function deleteAnalysisTask(id: string): boolean {
  const result = db.prepare('DELETE FROM analysis_tasks WHERE id = ?').run(id)
  if (result.changes > 0) {
    db.prepare('DELETE FROM task_logs WHERE taskId = ?').run(id)
    return true
  }
  return false
}

export function updateAnalysisTaskStatus(
  id: string,
  status: TaskStatus,
  updates?: { resultContent?: string; errorMessage?: string; progress?: AnalysisProgress }
): AnalysisTask | null {
  const task = getAnalysisTaskById(id)
  if (!task) return null

  task.status = status
  task.updatedAt = new Date().toISOString()

  if (updates?.resultContent !== undefined) task.resultContent = updates.resultContent
  if (updates?.errorMessage !== undefined) task.errorMessage = updates.errorMessage
  if (updates?.progress) task.progress = { ...task.progress, ...updates.progress }

  return saveAnalysisTask(task)
}

export function updateAnalysisTaskHeartbeat(id: string): AnalysisTask | null {
  const task = getAnalysisTaskById(id)
  if (!task) return null

  task.progress = {
    ...task.progress,
    lastHeartbeat: new Date().toISOString()
  }
  task.updatedAt = new Date().toISOString()

  return saveAnalysisTask(task)
}

// ────────────────────────────────────────────────────────────
// 原型项目操作方法
// ────────────────────────────────────────────────────────────

export function getProjects(): PrototypeProject[] {
  const rows = db.prepare('SELECT * FROM prototype_projects ORDER BY createdAt DESC').all() as any[]
  return rows.map(row => ({
    ...row,
    data: fromDB<PrototypeData>(row.data),
    versions: fromDB<PrototypeVersion[]>(row.versions) || [],
    progress: fromDB<GenerateProgress>(row.progress)
  }))
}

export function getProjectById(id: string): PrototypeProject | undefined {
  const row = db.prepare('SELECT * FROM prototype_projects WHERE id = ?').get(id) as any
  if (!row) return undefined
  return {
    ...row,
    data: fromDB<PrototypeData>(row.data),
    versions: fromDB<PrototypeVersion[]>(row.versions) || [],
    progress: fromDB<GenerateProgress>(row.progress)
  }
}

export function saveProject(project: PrototypeProject): PrototypeProject {
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
  logger.info('Database', `保存原型项目: ${project.id}`, `Status: ${project.status}, Pages: ${project.data?.pages?.length || 0}`)
  return project
}

export function deleteProject(id: string): boolean {
  const result = db.prepare('DELETE FROM prototype_projects WHERE id = ?').run(id)
  if (result.changes > 0) {
    db.prepare('DELETE FROM task_logs WHERE taskId = ?').run(id)
    return true
  }
  return false
}

export function updateProjectProgress(id: string, progress: Partial<GenerateProgress>): PrototypeProject | null {
  const project = getProjectById(id)
  if (!project) return null

  project.progress = {
    step: progress.step ?? project.progress?.step ?? 'idle',
    totalPages: progress.totalPages ?? project.progress?.totalPages ?? 0,
    currentPage: progress.currentPage ?? project.progress?.currentPage ?? 0,
    currentPageName: progress.currentPageName ?? project.progress?.currentPageName ?? '',
    completedPages: progress.completedPages ?? project.progress?.completedPages ?? [],
    errorMessage: progress.errorMessage ?? project.progress?.errorMessage,
    lastHeartbeat: progress.lastHeartbeat ?? project.progress?.lastHeartbeat
  }
  project.updatedAt = new Date().toISOString()

  return saveProject(project)
}

export function updateProjectStatusAndProgress(
  id: string,
  status: TaskStatus,
  progress?: Partial<GenerateProgress>,
  errorMessage?: string
): PrototypeProject | null {
  const project = getProjectById(id)
  if (!project) return null

  project.status = status
  project.updatedAt = new Date().toISOString()
  if (errorMessage) project.errorMessage = errorMessage

  if (progress) {
    project.progress = {
      step: progress.step ?? project.progress?.step ?? 'idle',
      totalPages: progress.totalPages ?? project.progress?.totalPages ?? 0,
      currentPage: progress.currentPage ?? project.progress?.currentPage ?? 0,
      currentPageName: progress.currentPageName ?? project.progress?.currentPageName ?? '',
      completedPages: progress.completedPages ?? project.progress?.completedPages ?? [],
      errorMessage: progress.errorMessage ?? project.progress?.errorMessage,
      lastHeartbeat: progress.lastHeartbeat ?? project.progress?.lastHeartbeat
    }
  }

  return saveProject(project)
}

// ────────────────────────────────────────────────────────────
// 设计文档操作方法
// ────────────────────────────────────────────────────────────

export function getDesignDocs(): DesignDoc[] {
  const rows = db.prepare('SELECT * FROM design_docs ORDER BY createdAt DESC').all() as any[]
  return rows.map(row => ({
    ...row,
    progress: fromDB<DesignDocProgress>(row.progress)
  }))
}

export function getDesignDocById(id: string): DesignDoc | undefined {
  const row = db.prepare('SELECT * FROM design_docs WHERE id = ?').get(id) as any
  if (!row) return undefined
  return {
    ...row,
    progress: fromDB<DesignDocProgress>(row.progress)
  }
}

export function saveDesignDoc(doc: DesignDoc): DesignDoc {
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
}

export function deleteDesignDoc(id: string): boolean {
  const result = db.prepare('DELETE FROM design_docs WHERE id = ?').run(id)
  if (result.changes > 0) {
    db.prepare('DELETE FROM task_logs WHERE taskId = ?').run(id)
    return true
  }
  return false
}

export function updateDesignDocStatus(
  id: string,
  status: TaskStatus,
  updates?: { resultContent?: string; errorMessage?: string; progress?: Partial<DesignDocProgress> }
): DesignDoc | null {
  const doc = getDesignDocById(id)
  if (!doc) return null

  doc.status = status
  doc.updatedAt = new Date().toISOString()

  if (updates?.resultContent !== undefined) doc.resultContent = updates.resultContent
  if (updates?.errorMessage !== undefined) doc.errorMessage = updates.errorMessage
  if (updates?.progress) {
    doc.progress = {
      totalPages: updates.progress.totalPages ?? doc.progress?.totalPages ?? 0,
      currentPage: updates.progress.currentPage ?? doc.progress?.currentPage ?? 0,
      currentPageName: updates.progress.currentPageName ?? doc.progress?.currentPageName ?? '',
      percentage: updates.progress.percentage ?? doc.progress?.percentage ?? 0,
      lastHeartbeat: updates.progress.lastHeartbeat ?? doc.progress?.lastHeartbeat
    }
  }

  return saveDesignDoc(doc)
}

export function updateDesignDocProgress(
  id: string,
  progress: Partial<DesignDocProgress>
): DesignDoc | null {
  const doc = getDesignDocById(id)
  if (!doc) return null

  doc.progress = {
    totalPages: progress.totalPages ?? doc.progress?.totalPages ?? 0,
    currentPage: progress.currentPage ?? doc.progress?.currentPage ?? 0,
    currentPageName: progress.currentPageName ?? doc.progress?.currentPageName ?? '',
    percentage: progress.percentage ?? doc.progress?.percentage ?? 0,
    lastHeartbeat: progress.lastHeartbeat ?? new Date().toISOString()
  }
  doc.updatedAt = new Date().toISOString()

  return saveDesignDoc(doc)
}

// ────────────────────────────────────────────────────────────
// 日志操作方法
// ────────────────────────────────────────────────────────────

export function getLogs(): TaskLog[] {
  const rows = db.prepare('SELECT * FROM task_logs ORDER BY timestamp DESC').all() as any[]
  return rows
}

export function getLogsByTaskId(taskId: string): TaskLog[] {
  const rows = db.prepare('SELECT * FROM task_logs WHERE taskId = ? ORDER BY timestamp DESC').all(taskId) as any[]
  return rows
}

export function addLog(log: Omit<TaskLog, 'id'>): TaskLog {
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
}

export function clearLogsByTaskId(taskId: string): void {
  db.prepare('DELETE FROM task_logs WHERE taskId = ?').run(taskId)
}

// ────────────────────────────────────────────────────────────
// 数据清除操作方法
// ────────────────────────────────────────────────────────────

export function clearAllMarketReports(): void {
  db.prepare('DELETE FROM market_reports').run()
  db.prepare('DELETE FROM task_logs WHERE taskId NOT IN (SELECT id FROM analysis_tasks) AND taskId NOT IN (SELECT id FROM prototype_projects) AND taskId NOT IN (SELECT id FROM design_docs)').run()
}

export function clearAllAnalysisTasks(): void {
  db.prepare('DELETE FROM analysis_tasks').run()
  db.prepare('DELETE FROM task_logs WHERE taskId NOT IN (SELECT id FROM market_reports) AND taskId NOT IN (SELECT id FROM prototype_projects) AND taskId NOT IN (SELECT id FROM design_docs)').run()
}

export function clearAllProjects(): void {
  db.prepare('DELETE FROM prototype_projects').run()
  db.prepare('DELETE FROM task_logs WHERE taskId NOT IN (SELECT id FROM market_reports) AND taskId NOT IN (SELECT id FROM analysis_tasks) AND taskId NOT IN (SELECT id FROM design_docs)').run()
}

export function clearAllDesignDocs(): void {
  db.prepare('DELETE FROM design_docs').run()
  db.prepare('DELETE FROM task_logs WHERE taskId NOT IN (SELECT id FROM market_reports) AND taskId NOT IN (SELECT id FROM analysis_tasks) AND taskId NOT IN (SELECT id FROM prototype_projects)').run()
}

export function clearAllData(): void {
  db.prepare('DELETE FROM market_reports').run()
  db.prepare('DELETE FROM analysis_tasks').run()
  db.prepare('DELETE FROM prototype_projects').run()
  db.prepare('DELETE FROM design_docs').run()
  db.prepare('DELETE FROM task_logs').run()
}

export function getStorePath(): string {
  return dbPath
}

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
    }
  }
}

const DEFAULT_SETTINGS: ConfigSchema['settings'] = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-reasoner',
  prompts: {},
  searchConfig: { enabled: false, sources: ['bing_cn'] }
}

/** 迁移电子商店数据到 SQLite */
function migrateFromElectronStore() {
  const configStore = new Store<ConfigSchema>({ name: 'config' })
  const oldSettings = configStore.get('settings')

  if (oldSettings && Object.keys(oldSettings).length > 0) {
    logger.info('Database', '发现旧配置，正在迁移到 SQLite...', `Path: ${configStore.path}`)
    saveAppSettings(oldSettings)
    // 迁移后清空旧配置，避免重复迁移
    configStore.delete('settings')
    logger.info('Database', '配置迁移完成')
  }
}

export function getAppSettings(): ConfigSchema['settings'] {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('current_settings') as { value: string } | undefined
  if (!row) {
    return DEFAULT_SETTINGS
  }
  return fromDB<ConfigSchema['settings']>(row.value) || DEFAULT_SETTINGS
}

export function saveAppSettings(settings: any) {
  const stmt = db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)')
  stmt.run('current_settings', toDB(settings))
  return settings
}

export function getConfigPath(): string {
  return dbPath
}

// 执行迁移
migrateFromElectronStore()

export default db
