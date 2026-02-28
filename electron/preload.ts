import { contextBridge, ipcRenderer } from 'electron'

// ────────────────────────────────────────────────────────────
// 暴露给渲染进程的安全 API（通过 contextBridge）
// ────────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
  // ── AI 调用 ──────────────────────────────────────────────
  /** 发起 AI 调用（流式） */
  aiCall: (params: AiCallParams) => ipcRenderer.invoke('ai:call', params),
  /** 监听流式输出块 */
  onAiStreamChunk: (callback: (data: { chunk: string; type: string }) => void) => {
    ipcRenderer.on('ai:stream-chunk', (_event, data) => callback(data))
  },
  /** 监听流式输出完成 */
  onAiStreamDone: (callback: (data: { content: string; type: string }) => void) => {
    ipcRenderer.on('ai:stream-done', (_event, data) => callback(data))
  },
  /** 监听流式输出错误 */
  onAiStreamError: (callback: (data: { error: string; type: string }) => void) => {
    ipcRenderer.on('ai:stream-error', (_event, data) => callback(data))
  },
  /** 移除 AI 相关所有监听器 */
  removeAiListeners: () => {
    ipcRenderer.removeAllListeners('ai:stream-chunk')
    ipcRenderer.removeAllListeners('ai:stream-done')
    ipcRenderer.removeAllListeners('ai:stream-error')
  },

  // ── 文件操作 ─────────────────────────────────────────────
  /** 显示保存文件对话框 */
  showSaveDialog: (options: SaveDialogOptions) => ipcRenderer.invoke('file:save-dialog', options),
  /** 写入文件 */
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('file:write', { filePath, content }),
  /** 用系统默认应用打开文件 */
  openFile: (filePath: string) => ipcRenderer.invoke('file:open', filePath),
  /** 打开外部链接 */
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),

  // ── 数据库操作 ───────────────────────────────────────────
  /** 获取所有项目 */
  dbGetProjects: () => ipcRenderer.invoke('db:get-projects'),
  /** 获取单个项目 */
  dbGetProject: (id: string) => ipcRenderer.invoke('db:get-project', id),
  /** 保存项目（新增或更新） */
  dbSaveProject: (project: PrototypeProject) => ipcRenderer.invoke('db:save-project', project),
  /** 删除项目 */
  dbDeleteProject: (id: string) => ipcRenderer.invoke('db:delete-project', id),
  /** 获取项目日志 */
  dbGetLogs: (taskId: string) => ipcRenderer.invoke('db:get-logs', taskId),
  /** 添加日志 */
  dbAddLog: (log: TaskLogInput) => ipcRenderer.invoke('db:add-log', log),
  /** 更新项目进度 */
  dbUpdateProgress: (id: string, progress: GenerateProgressInput) => ipcRenderer.invoke('db:update-progress', { id, progress }),
  /** 更新项目状态和进度 */
  dbUpdateStatusProgress: (id: string, status: TaskStatus, progress?: GenerateProgressInput, errorMessage?: string) =>
    ipcRenderer.invoke('db:update-status-progress', { id, status, progress, errorMessage }),

  // ── 后台任务执行 ─────────────────────────────────────────
  /** 启动原型生成任务（后端执行） */
  taskStartGenerate: (projectId: string, apiKey: string, baseUrl: string, model?: string, prompts?: Record<string, string>) =>
    ipcRenderer.invoke('task:start-generate', { projectId, apiKey, baseUrl, model, prompts }),
  /** 取消任务 */
  taskCancel: (projectId: string) => ipcRenderer.invoke('task:cancel', projectId),

  // ── 需求分析任务 ───────────────────────────────────────────
  /** 获取所有分析任务 */
  analysisGetTasks: () => ipcRenderer.invoke('analysis:get-tasks'),
  /** 获取单个分析任务 */
  analysisGetTask: (id: string) => ipcRenderer.invoke('analysis:get-task', id),
  /** 保存分析任务 */
  analysisSaveTask: (task: AnalysisTaskInput) => ipcRenderer.invoke('analysis:save-task', task),
  /** 删除分析任务 */
  analysisDeleteTask: (id: string) => ipcRenderer.invoke('analysis:delete-task', id),
  /** 获取分析任务日志 */
  analysisGetLogs: (taskId: string) => ipcRenderer.invoke('analysis:get-logs', taskId),
  /** 启动分析任务 */
  analysisStart: (taskId: string, apiKey: string, baseUrl: string, model?: string, prompts?: Record<string, string>) =>
    ipcRenderer.invoke('analysis:start', { taskId, apiKey, baseUrl, model, prompts }),
  /** 取消分析任务 */
  analysisCancel: (taskId: string) => ipcRenderer.invoke('analysis:cancel', taskId),

  // ── 市场报告任务 ───────────────────────────────────────
  /** 获取所有市场报告 */
  marketGetReports: () => ipcRenderer.invoke('market:get-reports'),
  /** 获取单个市场报告 */
  marketGetReport: (id: string) => ipcRenderer.invoke('market:get-report', id),
  /** 保存市场报告 */
  marketSaveReport: (report: MarketReportInput) => ipcRenderer.invoke('market:save-report', report),
  /** 删除市场报告 */
  marketDeleteReport: (id: string) => ipcRenderer.invoke('market:delete-report', id),
  /** 获取市场报告日志 */
  marketGetLogs: (taskId: string) => ipcRenderer.invoke('market:get-logs', taskId),
  /** 启动市场报告生成 */
  marketStart: (reportId: string, apiKey: string, baseUrl: string, model?: string, prompts?: Record<string, string>, searchConfig?: { enabled: boolean; sources: string[] }) =>
    ipcRenderer.invoke('market:start', { reportId, apiKey, baseUrl, model, prompts, searchConfig }),
  /** 取消市场报告生成 */
  marketCancel: (reportId: string) => ipcRenderer.invoke('market:cancel', reportId),

  // ── 设计文档任务 ───────────────────────────────────────
  /** 获取所有设计文档 */
  designGetDocs: () => ipcRenderer.invoke('design:get-docs'),
  /** 获取单个设计文档 */
  designGetDoc: (id: string) => ipcRenderer.invoke('design:get-doc', id),
  /** 保存设计文档 */
  designSaveDoc: (doc: DesignDocInput) => ipcRenderer.invoke('design:save-doc', doc),
  /** 删除设计文档 */
  designDeleteDoc: (id: string) => ipcRenderer.invoke('design:delete-doc', id),
  /** 获取设计文档日志 */
  designGetLogs: (taskId: string) => ipcRenderer.invoke('design:get-logs', taskId),
  /** 启动设计文档生成 */
  designStart: (docId: string, apiKey: string, baseUrl: string, model?: string, prompts?: Record<string, string>) =>
    ipcRenderer.invoke('design:start', { docId, apiKey, baseUrl, model, prompts }),
  /** 取消设计文档生成 */
  designCancel: (docId: string) => ipcRenderer.invoke('design:cancel', docId),

  // ── 数据清除操作 ───────────────────────────────────────
  /** 清除所有市场报告 */
  dataClearMarket: () => ipcRenderer.invoke('data:clear-market'),
  /** 清除所有需求分析 */
  dataClearAnalysis: () => ipcRenderer.invoke('data:clear-analysis'),
  /** 清除所有产品原型 */
  dataClearPrototype: () => ipcRenderer.invoke('data:clear-prototype'),
  /** 清除所有设计文档 */
  dataClearDesign: () => ipcRenderer.invoke('data:clear-design'),

  // ── 应用配置 ───────────────────────────────────────
  /** 获取配置文件物理路径 */
  appGetConfigPath: () => ipcRenderer.invoke('app:get-config-path'),
  /** 打开配置文件所在文件夹 */
  appOpenConfigFolder: () => ipcRenderer.invoke('app:open-config-folder'),

  // ── 应用配置 (config.json) ───────────────────────────
  /** 获取应用设置 */
  configGet: () => ipcRenderer.invoke('config:get'),
  /** 保存应用设置 */
  configSave: (settings: any) => ipcRenderer.invoke('config:save', settings),
  /** 获取 config.json 路径 */
  configGetPath: () => ipcRenderer.invoke('config:get-path')
})

// ────────────────────────────────────────────────────────────
// 类型声明（仅用于 preload，渲染进程通过 electron.d.ts 获取类型）
// ────────────────────────────────────────────────────────────
interface AiCallParams {
  type: string
  payload: Record<string, unknown>
  apiKey: string
  baseUrl: string
  model?: string
}

interface SaveDialogOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}

// 数据库相关类型
type TaskLogType = 'create' | 'status_change' | 'generate_start' | 'generate_step' | 'generate_done' | 'error'
type TaskStatus = 'pending' | 'generating' | 'completed' | 'failed'

interface TaskLogInput {
  taskId: string
  type: TaskLogType
  message: string
  detail?: string
  timestamp: string
}

interface PrototypeProject {
  id: string
  title: string
  status: TaskStatus
  clientType: string
  sourceAnalysisId: string
  analysisContent: string
  data: unknown
  versions: unknown[]
  createdAt: string
  updatedAt: string
  errorMessage?: string
  progress?: GenerateProgressInput
}

type GenStep = 'idle' | 'plan' | 'pages' | 'done' | 'error'

interface GenerateProgressInput {
  step?: GenStep
  totalPages?: number
  currentPage?: number
  currentPageName?: string
  completedPages?: { id: string; name: string }[]
  errorMessage?: string
}

/** 分析任务输入 */
interface AnalysisTaskInput {
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
  progress?: { lastHeartbeat?: string }
}

/** 市场报告输入 */
interface MarketReportInput {
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
  progress?: { lastHeartbeat?: string }
}

/** 设计文档进度 */
interface DesignDocProgressInput {
  totalPages: number
  currentPage: number
  currentPageName: string
  percentage: number
  lastHeartbeat?: string
}

/** 设计文档输入 */
interface DesignDocInput {
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
  progress?: DesignDocProgressInput
}
