// 渲染进程中 window.electronAPI 的类型声明

interface AiCallParams {
  type: 'market-insight' | 'product-analysis' | 'product-prototype' | 'prototype-plan' | 'prototype-page'
  payload: Record<string, unknown>
  apiKey: string
  baseUrl: string
  model?: string
  systemPrompt?: string
}

interface SaveDialogOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}

interface SaveDialogResult {
  canceled: boolean
  filePath?: string
}

// 数据库相关类型
export type TaskLogType = 'create' | 'status_change' | 'generate_start' | 'generate_step' | 'generate_done' | 'error'
export type TaskStatus = 'pending' | 'generating' | 'completed' | 'failed'

export interface TaskLog {
  id: string
  taskId: string
  type: TaskLogType
  message: string
  detail?: string
  timestamp: string
}

export interface TaskLogInput {
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

export type GenStep = 'idle' | 'plan' | 'pages' | 'done' | 'error'

export interface GenerateProgress {
  step: GenStep
  totalPages: number
  currentPage: number
  currentPageName: string
  completedPages: { id: string; name: string }[]
  errorMessage?: string
  /** 心跳时间戳，用于检测异步任务是否存活 */
  lastHeartbeat?: string
}

// 需求分析任务类型
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

// 市场报告类型
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
  resultContent?: string
  createdAt: string
  updatedAt: string
  errorMessage?: string
  progress?: MarketProgress
}

// 设计文档类型
export interface DesignDocProgress {
  totalPages: number        // 总页面数
  currentPage: number       // 当前处理页面
  currentPageName: string   // 当前页面名称
  percentage: number        // 进度百分比 0-100
  lastHeartbeat?: string
}

export interface DesignDoc {
  id: string
  title: string                   // 文档标题
  status: TaskStatus              // pending | generating | completed | failed
  sourceProjectId: string         // 关联的原型项目ID
  sourceProjectTitle: string      // 关联的原型项目标题
  pageCount: number               // 原型页面数量
  resultContent?: string          // 生成的MD文档内容
  createdAt: string
  updatedAt: string
  errorMessage?: string
  progress?: DesignDocProgress
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

interface DbResult<T> {
  success: boolean
  data?: T
  error?: string
}

interface ElectronAPI {
  // AI 调用
  aiCall: (params: AiCallParams) => Promise<{ success: boolean; content?: string; error?: string }>
  onAiStreamChunk: (callback: (data: { chunk: string; type: string }) => void) => void
  onAiStreamDone: (callback: (data: { content: string; type: string }) => void) => void
  onAiStreamError: (callback: (data: { error: string; type: string }) => void) => void
  removeAiListeners: () => void
  
  // 文件操作
  showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogResult>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  openFile: (filePath: string) => Promise<void>
  openExternal: (url: string) => Promise<void>
  
  // 数据库操作
  dbGetProjects: () => Promise<DbResult<PrototypeProject[]>>
  dbGetProject: (id: string) => Promise<DbResult<PrototypeProject | undefined>>
  dbSaveProject: (project: PrototypeProject) => Promise<DbResult<PrototypeProject>>
  dbDeleteProject: (id: string) => Promise<DbResult<boolean>>
  dbGetLogs: (taskId: string) => Promise<DbResult<TaskLog[]>>
  dbAddLog: (log: TaskLogInput) => Promise<DbResult<TaskLog>>
  dbUpdateProgress: (id: string, progress: Partial<GenerateProgress>) => Promise<DbResult<PrototypeProject>>
  dbUpdateStatusProgress: (id: string, status: TaskStatus, progress?: Partial<GenerateProgress>, errorMessage?: string) => Promise<DbResult<PrototypeProject>>
  
  // 后台任务执行
  taskStartGenerate: (projectId: string, apiKey: string, baseUrl: string, model?: string) => Promise<{ success: boolean; error?: string }>
  taskCancel: (projectId: string) => Promise<{ success: boolean; error?: string }>
  
  // 需求分析任务
  analysisGetTasks: () => Promise<DbResult<AnalysisTask[]>>
  analysisGetTask: (id: string) => Promise<DbResult<AnalysisTask | undefined>>
  analysisSaveTask: (task: AnalysisTask) => Promise<DbResult<AnalysisTask>>
  analysisDeleteTask: (id: string) => Promise<DbResult<boolean>>
  analysisGetLogs: (taskId: string) => Promise<DbResult<TaskLog[]>>
  analysisStart: (taskId: string, apiKey: string, baseUrl: string, model?: string) => Promise<{ success: boolean; error?: string }>
  analysisCancel: (taskId: string) => Promise<{ success: boolean; error?: string }>
  
  // 市场报告任务
  marketGetReports: () => Promise<DbResult<MarketReport[]>>
  marketGetReport: (id: string) => Promise<DbResult<MarketReport | undefined>>
  marketSaveReport: (report: MarketReport) => Promise<DbResult<MarketReport>>
  marketDeleteReport: (id: string) => Promise<DbResult<boolean>>
  marketGetLogs: (taskId: string) => Promise<DbResult<TaskLog[]>>
  marketStart: (reportId: string, apiKey: string, baseUrl: string, model?: string) => Promise<{ success: boolean; error?: string }>
  marketCancel: (reportId: string) => Promise<{ success: boolean; error?: string }>
  
  // 设计文档任务
  designGetDocs: () => Promise<DbResult<DesignDoc[]>>
  designGetDoc: (id: string) => Promise<DbResult<DesignDoc | undefined>>
  designSaveDoc: (doc: DesignDoc) => Promise<DbResult<DesignDoc>>
  designDeleteDoc: (id: string) => Promise<DbResult<boolean>>
  designGetLogs: (taskId: string) => Promise<DbResult<TaskLog[]>>
  designStart: (docId: string, apiKey: string, baseUrl: string, model?: string) => Promise<{ success: boolean; error?: string }>
  designCancel: (docId: string) => Promise<{ success: boolean; error?: string }>
  
  // 数据清除操作
  dataClearMarket: () => Promise<{ success: boolean; error?: string }>
  dataClearAnalysis: () => Promise<{ success: boolean; error?: string }>
  dataClearPrototype: () => Promise<{ success: boolean; error?: string }>
  dataClearDesign: () => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
