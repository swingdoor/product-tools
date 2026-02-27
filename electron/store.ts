import Store from 'electron-store'

// ────────────────────────────────────────────────────────────
// 类型定义
// ────────────────────────────────────────────────────────────

/** 日志类型 */
export type TaskLogType = 'create' | 'status_change' | 'generate_start' | 'generate_step' | 'generate_done' | 'error'

/** 任务日志 */
export interface TaskLog {
  id: string
  taskId: string
  type: TaskLogType
  message: string
  detail?: string
  timestamp: string
}

/** 任务状态 */
export type TaskStatus = 'pending' | 'generating' | 'completed' | 'failed'

/** HTML 原型页面 */
export interface PrototypePage {
  id: string
  name: string
  description: string
  prompt: string
  htmlContent: string
}

/** 原型数据 */
export interface PrototypeData {
  appName: string
  clientType: string
  pages: PrototypePage[]
}

/** 版本快照 */
export interface PrototypeVersion {
  id: string
  data: PrototypeData
  savedAt: string
  description: string
}

/** 生成步骤 */
export type GenStep = 'idle' | 'plan' | 'pages' | 'done' | 'error'

/** 生成进度信息 */
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

/** 原型项目 */
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
  // 生成进度信息
  progress?: GenerateProgress
}

// ────────────────────────────────────────────────────────────
// 需求分析任务类型
// ────────────────────────────────────────────────────────────

/** 分析任务进度 */
export interface AnalysisProgress {
  lastHeartbeat?: string
}

/** 需求分析任务 */
export interface AnalysisTask {
  id: string
  title: string
  status: TaskStatus
  sourceReportId?: string       // 关联的市场报告ID
  sourceReportTitle?: string    // 关联的市场报告标题
  inputContent: string          // 输入内容（市场报告或手动输入）
  resultContent?: string        // 分析结果（MD格式）
  createdAt: string
  updatedAt: string
  errorMessage?: string
  progress?: AnalysisProgress
}

/** Store 数据结构 */
interface StoreSchema {
  projects: PrototypeProject[]
  logs: TaskLog[]
  analysisTasks: AnalysisTask[]
  marketReports: MarketReport[]
  designDocs: DesignDoc[]
}

// ────────────────────────────────────────────────────────────────
// 市场报告类型
// ────────────────────────────────────────────────────────────────

/** 市场报告进度 */
export interface MarketProgress {
  lastHeartbeat?: string
}

/** 市场洞察报告 */
export interface MarketReport {
  id: string
  title: string                 // 报告标题
  status: TaskStatus            // 任务状态
  industry: string              // 行业/领域
  targetUsers: string           // 目标用户（逗号分隔）
  focusAreas: string[]          // 核心关注方向
  dataSources: string           // 参考数据源
  resultContent?: string        // 报告内容（MD格式）
  createdAt: string
  updatedAt: string
  errorMessage?: string
  progress?: MarketProgress
}

// ──────────────────────────────────────────────────────────────────
// 设计文档类型
// ──────────────────────────────────────────────────────────────────

/** 设计文档进度 */
export interface DesignDocProgress {
  totalPages: number      // 总页面数
  currentPage: number     // 当前处理页面
  currentPageName: string // 当前页面名称
  percentage: number      // 进度百分比 0-100
  lastHeartbeat?: string
}

/** 设计文档 */
export interface DesignDoc {
  id: string
  title: string                 // 文档标题
  status: TaskStatus            // 任务状态
  sourceProjectId: string       // 关联的原型项目ID
  sourceProjectTitle: string    // 关联的原型项目标题
  pageCount: number             // 原型页面数量
  resultContent?: string        // 生成的MD文档内容
  createdAt: string
  updatedAt: string
  errorMessage?: string
  progress?: DesignDocProgress
}

// ────────────────────────────────────────────────────────────
// 示例数据（首次使用时显示）
// ────────────────────────────────────────────────────────────

const SAMPLE_MARKET_REPORT: MarketReport = {
  id: 'sample_market_001',
  title: '【示例】智能家居市场洞察报告',
  status: 'completed',
  industry: '智能家居/物联网',
  targetUsers: '年轻家庭用户,科技爱好者,都市白领',
  focusAreas: ['市场规模与增长趋势', '竞品分析', '用户需求痛点', '技术发展方向'],
  dataSources: '公开市场报告、行业数据',
  resultContent: `# 智能家居市场洞察报告\n\n## 一、市场概况\n\n智能家居市场正处于快速增长阶段，预计2025年全球市场规模将突破1500亿美元。\n\n## 二、目标用户画像\n\n- **年轻家庭**：追求便捷生活，愿意尝试新科技\n- **科技爱好者**：对智能设备有较高接受度\n- **都市白领**：工作繁忙，希望通过智能化提升生活品质\n\n## 三、核心需求与痛点\n\n1. **安全监控**：远程查看家中情况\n2. **节能环保**：智能控制电器减少能耗\n3. **便捷控制**：语音或APP一键控制\n\n## 四、竞品分析\n\n| 品牌 | 核心优势 | 主要产品 |\n|------|---------|---------|\n| 小米 | 性价比高 | 全屋智能套装 |\n| 华为 | 生态完整 | HarmonyOS连接 |\n| 涂鸦 | 开放平台 | 智能模组方案 |\n\n## 五、机会与建议\n\n- 聚焦细分场景（如老人看护、宠物监控）\n- 强化语音交互体验\n- 打通多品牌设备互联`,
  createdAt: '2025-01-15 10:30:00',
  updatedAt: '2025-01-15 10:35:00'
}

const SAMPLE_ANALYSIS_TASK: AnalysisTask = {
  id: 'sample_analysis_001',
  title: '【示例】智能家居APP需求分析',
  status: 'completed',
  sourceReportId: 'sample_market_001',
  sourceReportTitle: '【示例】智能家居市场洞察报告',
  inputContent: '基于智能家居市场洞察报告进行产品需求分析',
  resultContent: `# 智能家居APP产品需求分析\n\n## 一、产品定位\n\n面向年轻家庭用户的全屋智能控制中心APP，提供设备管理、场景联动、安全监控等核心功能。\n\n## 二、核心功能模块\n\n### 2.1 设备管理\n- 设备添加与配置\n- 设备状态实时查看\n- 远程控制开关\n\n### 2.2 场景联动\n- 预设场景（回家/离家/睡眠）\n- 自定义场景编排\n- 定时任务设置\n\n### 2.3 安全中心\n- 摄像头实时预览\n- 门锁状态监控\n- 异常告警推送\n\n## 三、用户角色\n\n| 角色 | 权限 | 说明 |\n|------|-----|------|\n| 管理员 | 全部 | 家庭主账号 |\n| 成员 | 控制+查看 | 家庭成员 |\n| 访客 | 仅查看 | 临时授权 |\n\n## 四、非功能需求\n\n- 响应时间 < 2秒\n- 支持离线控制\n- 数据加密传输`,
  createdAt: '2025-01-16 14:00:00',
  updatedAt: '2025-01-16 14:20:00'
}

const SAMPLE_PROJECT: PrototypeProject = {
  id: 'sample_prototype_001',
  title: '【示例】智能家居APP原型',
  status: 'completed',
  clientType: 'mobile',
  sourceAnalysisId: 'sample_analysis_001',
  analysisContent: '智能家居APP产品需求分析文档',
  data: {
    appName: '智能家居APP',
    clientType: 'mobile',
    pages: [
      {
        id: 'page_home',
        name: '首页',
        description: '展示设备概览和快捷场景',
        prompt: '智能家居APP首页',
        htmlContent: `<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>首页</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f5f5}.header{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:20px 16px;border-radius:0 0 24px 24px}.greeting{font-size:24px;font-weight:600}.subtitle{font-size:14px;opacity:.8;margin-top:4px}.stats{display:flex;gap:12px;padding:16px}.stat-card{flex:1;background:#fff;border-radius:12px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.05)}.stat-num{font-size:28px;font-weight:700;color:#667eea}.stat-label{font-size:12px;color:#999;margin-top:4px}.section{padding:0 16px}.section-title{font-size:16px;font-weight:600;margin:16px 0 12px}.scene-list{display:flex;gap:12px;overflow-x:auto;padding-bottom:12px}.scene-item{flex-shrink:0;width:100px;background:#fff;border-radius:12px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.05)}.scene-icon{font-size:32px;margin-bottom:8px}.scene-name{font-size:13px;color:#333}.device-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding-bottom:80px}.device-card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.05)}.device-icon{font-size:28px;margin-bottom:8px}.device-name{font-size:14px;font-weight:500}.device-status{font-size:12px;color:#52c41a;margin-top:4px}.nav{position:fixed;bottom:0;left:0;right:0;background:#fff;display:flex;padding:12px 0;box-shadow:0 -2px 12px rgba(0,0,0,.08)}.nav-item{flex:1;text-align:center;color:#999}.nav-item.active{color:#667eea}.nav-icon{font-size:24px}.nav-label{font-size:11px;margin-top:2px}</style></head><body><div class="header"><div class="greeting">欢迎回家</div><div class="subtitle">当前有 8 个设备在线</div></div><div class="stats"><div class="stat-card"><div class="stat-num">8</div><div class="stat-label">在线设备</div></div><div class="stat-card"><div class="stat-num">3</div><div class="stat-label">运行中</div></div><div class="stat-card"><div class="stat-num">24°</div><div class="stat-label">室内温度</div></div></div><div class="section"><div class="section-title">快捷场景</div><div class="scene-list"><div class="scene-item"><div class="scene-icon">🏠</div><div class="scene-name">回家模式</div></div><div class="scene-item"><div class="scene-icon">🌙</div><div class="scene-name">睡眠模式</div></div><div class="scene-item"><div class="scene-icon">🚪</div><div class="scene-name">离家模式</div></div><div class="scene-item"><div class="scene-icon">🎬</div><div class="scene-name">观影模式</div></div></div></div><div class="section"><div class="section-title">我的设备</div><div class="device-grid"><div class="device-card"><div class="device-icon">💡</div><div class="device-name">客厅主灯</div><div class="device-status">● 已开启</div></div><div class="device-card"><div class="device-icon">❄️</div><div class="device-name">空调</div><div class="device-status">● 制冷中 24°</div></div><div class="device-card"><div class="device-icon">📺</div><div class="device-name">智能电视</div><div class="device-status">○ 已关闭</div></div><div class="device-card"><div class="device-icon">🔒</div><div class="device-name">智能门锁</div><div class="device-status">● 已上锁</div></div></div></div><div class="nav"><div class="nav-item active"><div class="nav-icon">🏠</div><div class="nav-label">首页</div></div><div class="nav-item"><div class="nav-icon">📱</div><div class="nav-label">设备</div></div><div class="nav-item"><div class="nav-icon">⚡</div><div class="nav-label">场景</div></div><div class="nav-item"><div class="nav-icon">👤</div><div class="nav-label">我的</div></div></div></body></html>`
      }
    ]
  },
  versions: [],
  createdAt: '2025-01-17 09:00:00',
  updatedAt: '2025-01-17 09:30:00'
}

const SAMPLE_DESIGN_DOC: DesignDoc = {
  id: 'sample_design_001',
  title: '【示例】智能家居APP首页设计文档',
  status: 'completed',
  sourceProjectId: 'sample_prototype_001',
  sourceProjectTitle: '【示例】智能家居APP原型',
  pageCount: 1,
  resultContent: `# 智能家居APP首页设计文档\n\n## 一、页面概述\n\n首页作为APP的核心入口，展示用户的设备概览、快捷场景和常用设备，帮助用户快速了解家居状态并进行控制。\n\n## 二、功能点清单\n\n| 功能模块 | 功能点 | 说明 |\n|---------|-------|------|\n| 顶部区域 | 欢迎语 | 显示个性化问候 |\n| 顶部区域 | 设备统计 | 在线设备数量 |\n| 统计卡片 | 设备数量 | 在线设备总数 |\n| 统计卡片 | 运行中 | 当前运行设备 |\n| 统计卡片 | 室内温度 | 实时温度显示 |\n| 快捷场景 | 场景列表 | 横向滚动展示 |\n| 快捷场景 | 一键触发 | 点击执行场景 |\n| 设备列表 | 设备卡片 | 展示设备状态 |\n| 设备列表 | 快捷开关 | 点击切换状态 |\n| 底部导航 | Tab切换 | 4个主要页面 |\n\n## 三、交互逻辑\n\n1. **场景触发**：点击场景卡片 → 弹出确认 → 执行场景 → 提示成功\n2. **设备控制**：点击设备卡片 → 跳转设备详情 / 长按快捷开关\n3. **下拉刷新**：下拉页面 → 刷新设备状态\n\n## 四、异常处理\n\n- 网络断开：显示离线提示，使用缓存数据\n- 设备离线：设备卡片置灰，显示离线标识\n- 场景执行失败：Toast提示具体错误原因`,
  createdAt: '2025-01-18 11:00:00',
  updatedAt: '2025-01-18 11:15:00'
}

// ────────────────────────────────────────────────────────────
// 初始化 Store
// ────────────────────────────────────────────────────────────

const store = new Store<StoreSchema>({
  name: 'prototype-tasks',
  defaults: {
    projects: [SAMPLE_PROJECT],
    logs: [],
    analysisTasks: [SAMPLE_ANALYSIS_TASK],
    marketReports: [SAMPLE_MARKET_REPORT],
    designDocs: [SAMPLE_DESIGN_DOC]
  }
})

// ────────────────────────────────────────────────────────────
// 项目操作方法
// ────────────────────────────────────────────────────────────

/** 获取所有项目 */
export function getProjects(): PrototypeProject[] {
  return store.get('projects', [])
}

/** 获取单个项目 */
export function getProjectById(id: string): PrototypeProject | undefined {
  const projects = getProjects()
  return projects.find(p => p.id === id)
}

/** 保存项目（新增或更新） */
export function saveProject(project: PrototypeProject): PrototypeProject {
  const projects = getProjects()
  const existingIndex = projects.findIndex(p => p.id === project.id)
  
  if (existingIndex !== -1) {
    // 更新现有项目
    projects[existingIndex] = project
  } else {
    // 新增项目（插入到最前面）
    projects.unshift(project)
    // 限制最大数量
    if (projects.length > 50) {
      projects.splice(50)
    }
  }
  
  store.set('projects', projects)
  return project
}

/** 删除项目 */
export function deleteProject(id: string): boolean {
  const projects = getProjects()
  const filteredProjects = projects.filter(p => p.id !== id)
  
  if (filteredProjects.length < projects.length) {
    store.set('projects', filteredProjects)
    // 同时删除相关日志
    const logs = getLogs()
    const filteredLogs = logs.filter(l => l.taskId !== id)
    store.set('logs', filteredLogs)
    return true
  }
  return false
}

// ────────────────────────────────────────────────────────────
// 日志操作方法
// ────────────────────────────────────────────────────────────

/** 获取所有日志 */
export function getLogs(): TaskLog[] {
  return store.get('logs', [])
}

/** 获取项目的日志 */
export function getLogsByTaskId(taskId: string): TaskLog[] {
  const logs = getLogs()
  return logs.filter(l => l.taskId === taskId).sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

/** 添加日志 */
export function addLog(log: Omit<TaskLog, 'id'>): TaskLog {
  const logs = getLogs()
  const newLog: TaskLog = {
    ...log,
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  logs.unshift(newLog)
  
  // 限制日志总数（保留最近1000条）
  if (logs.length > 1000) {
    logs.splice(1000)
  }
  
  store.set('logs', logs)
  return newLog
}

/** 清除项目日志 */
export function clearLogsByTaskId(taskId: string): void {
  const logs = getLogs()
  const filteredLogs = logs.filter(l => l.taskId !== taskId)
  store.set('logs', filteredLogs)
}

// ────────────────────────────────────────────────────────────
// 进度更新方法
// ────────────────────────────────────────────────────────────

/** 更新项目进度 */
export function updateProjectProgress(id: string, progress: Partial<GenerateProgress>): PrototypeProject | null {
  const project = getProjectById(id)
  if (!project) return null
  
  project.progress = {
    step: progress.step ?? project.progress?.step ?? 'idle',
    totalPages: progress.totalPages ?? project.progress?.totalPages ?? 0,
    currentPage: progress.currentPage ?? project.progress?.currentPage ?? 0,
    currentPageName: progress.currentPageName ?? project.progress?.currentPageName ?? '',
    completedPages: progress.completedPages ?? project.progress?.completedPages ?? [],
    errorMessage: progress.errorMessage ?? project.progress?.errorMessage
  }
  project.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
  
  return saveProject(project)
}

/** 更新项目状态和进度 */
export function updateProjectStatusAndProgress(
  id: string, 
  status: TaskStatus, 
  progress?: Partial<GenerateProgress>,
  errorMessage?: string
): PrototypeProject | null {
  const project = getProjectById(id)
  if (!project) return null
  
  project.status = status
  project.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
  if (errorMessage) project.errorMessage = errorMessage
  
  if (progress) {
    project.progress = {
      step: progress.step ?? project.progress?.step ?? 'idle',
      totalPages: progress.totalPages ?? project.progress?.totalPages ?? 0,
      currentPage: progress.currentPage ?? project.progress?.currentPage ?? 0,
      currentPageName: progress.currentPageName ?? project.progress?.currentPageName ?? '',
      completedPages: progress.completedPages ?? project.progress?.completedPages ?? [],
      errorMessage: progress.errorMessage ?? project.progress?.errorMessage
    }
  }
  
  return saveProject(project)
}

// ────────────────────────────────────────────────────────────
// 需求分析任务操作方法
// ────────────────────────────────────────────────────────────

/** 获取所有分析任务 */
export function getAnalysisTasks(): AnalysisTask[] {
  return store.get('analysisTasks', [])
}

/** 获取单个分析任务 */
export function getAnalysisTaskById(id: string): AnalysisTask | undefined {
  const tasks = getAnalysisTasks()
  return tasks.find(t => t.id === id)
}

/** 保存分析任务（新增或更新） */
export function saveAnalysisTask(task: AnalysisTask): AnalysisTask {
  const tasks = getAnalysisTasks()
  const existingIndex = tasks.findIndex(t => t.id === task.id)
  
  if (existingIndex !== -1) {
    tasks[existingIndex] = task
  } else {
    tasks.unshift(task)
    if (tasks.length > 50) {
      tasks.splice(50)
    }
  }
  
  store.set('analysisTasks', tasks)
  return task
}

/** 删除分析任务 */
export function deleteAnalysisTask(id: string): boolean {
  const tasks = getAnalysisTasks()
  const filtered = tasks.filter(t => t.id !== id)
  
  if (filtered.length < tasks.length) {
    store.set('analysisTasks', filtered)
    // 同时删除相关日志
    const logs = getLogs()
    const filteredLogs = logs.filter(l => l.taskId !== id)
    store.set('logs', filteredLogs)
    return true
  }
  return false
}

/** 更新分析任务状态和进度 */
export function updateAnalysisTaskStatus(
  id: string,
  status: TaskStatus,
  updates?: { resultContent?: string; errorMessage?: string; progress?: AnalysisProgress }
): AnalysisTask | null {
  const task = getAnalysisTaskById(id)
  if (!task) return null
  
  task.status = status
  task.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
  
  if (updates?.resultContent !== undefined) task.resultContent = updates.resultContent
  if (updates?.errorMessage !== undefined) task.errorMessage = updates.errorMessage
  if (updates?.progress) task.progress = { ...task.progress, ...updates.progress }
  
  return saveAnalysisTask(task)
}

/** 更新分析任务心跳 */
export function updateAnalysisTaskHeartbeat(id: string): AnalysisTask | null {
  const task = getAnalysisTaskById(id)
  if (!task) return null
  
  task.progress = {
    ...task.progress,
    lastHeartbeat: new Date().toISOString()
  }
  task.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
  
  return saveAnalysisTask(task)
}

// ────────────────────────────────────────────────────────────────
// 市场报告操作方法
// ────────────────────────────────────────────────────────────────

/** 获取所有市场报告 */
export function getMarketReports(): MarketReport[] {
  return store.get('marketReports', [])
}

/** 获取单个市场报告 */
export function getMarketReportById(id: string): MarketReport | undefined {
  const reports = getMarketReports()
  return reports.find(r => r.id === id)
}

/** 保存市场报告（新增或更新） */
export function saveMarketReport(report: MarketReport): MarketReport {
  const reports = getMarketReports()
  const existingIndex = reports.findIndex(r => r.id === report.id)
  
  if (existingIndex !== -1) {
    reports[existingIndex] = report
  } else {
    reports.unshift(report)
    if (reports.length > 50) {
      reports.splice(50)
    }
  }
  
  store.set('marketReports', reports)
  return report
}

/** 删除市场报告 */
export function deleteMarketReport(id: string): boolean {
  const reports = getMarketReports()
  const filtered = reports.filter(r => r.id !== id)
  
  if (filtered.length < reports.length) {
    store.set('marketReports', filtered)
    // 同时删除相关日志
    const logs = getLogs()
    const filteredLogs = logs.filter(l => l.taskId !== id)
    store.set('logs', filteredLogs)
    return true
  }
  return false
}

/** 更新市场报告状态和进度 */
export function updateMarketReportStatus(
  id: string,
  status: TaskStatus,
  updates?: { resultContent?: string; errorMessage?: string; progress?: MarketProgress }
): MarketReport | null {
  const report = getMarketReportById(id)
  if (!report) return null
  
  report.status = status
  report.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
  
  if (updates?.resultContent !== undefined) report.resultContent = updates.resultContent
  if (updates?.errorMessage !== undefined) report.errorMessage = updates.errorMessage
  if (updates?.progress) report.progress = { ...report.progress, ...updates.progress }
  
  return saveMarketReport(report)
}

/** 更新市场报告心跳 */
export function updateMarketReportHeartbeat(id: string): MarketReport | null {
  const report = getMarketReportById(id)
  if (!report) return null
  
  report.progress = {
    ...report.progress,
    lastHeartbeat: new Date().toISOString()
  }
  report.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
  
  return saveMarketReport(report)
}

// ──────────────────────────────────────────────────────────────────
// 设计文档操作方法
// ──────────────────────────────────────────────────────────────────

/** 获取所有设计文档 */
export function getDesignDocs(): DesignDoc[] {
  return store.get('designDocs', [])
}

/** 获取单个设计文档 */
export function getDesignDocById(id: string): DesignDoc | undefined {
  const docs = getDesignDocs()
  return docs.find(d => d.id === id)
}

/** 保存设计文档（新增或更新） */
export function saveDesignDoc(doc: DesignDoc): DesignDoc {
  const docs = getDesignDocs()
  const existingIndex = docs.findIndex(d => d.id === doc.id)
  
  if (existingIndex !== -1) {
    docs[existingIndex] = doc
  } else {
    docs.unshift(doc)
    if (docs.length > 50) {
      docs.splice(50)
    }
  }
  
  store.set('designDocs', docs)
  return doc
}

/** 删除设计文档 */
export function deleteDesignDoc(id: string): boolean {
  const docs = getDesignDocs()
  const filtered = docs.filter(d => d.id !== id)
  
  if (filtered.length < docs.length) {
    store.set('designDocs', filtered)
    // 同时删除相关日志
    const logs = getLogs()
    const filteredLogs = logs.filter(l => l.taskId !== id)
    store.set('logs', filteredLogs)
    return true
  }
  return false
}

/** 更新设计文档状态和进度 */
export function updateDesignDocStatus(
  id: string,
  status: TaskStatus,
  updates?: { resultContent?: string; errorMessage?: string; progress?: Partial<DesignDocProgress> }
): DesignDoc | null {
  const doc = getDesignDocById(id)
  if (!doc) return null
  
  doc.status = status
  doc.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
  
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

/** 更新设计文档进度 */
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
  doc.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
  
  return saveDesignDoc(doc)
}

// ──────────────────────────────────────────────────────────────────
// 数据清除操作方法
// ──────────────────────────────────────────────────────────────────

/** 清除所有市场报告 */
export function clearAllMarketReports(): void {
  // 先获取ID再清除，避免逻辑错误
  const marketReportIds = new Set(getMarketReports().map(r => r.id))
  const logs = getLogs()
  const filteredLogs = logs.filter(l => !marketReportIds.has(l.taskId))
  store.set('marketReports', [])
  store.set('logs', filteredLogs)
}

/** 清除所有需求分析任务 */
export function clearAllAnalysisTasks(): void {
  const analysisIds = new Set(getAnalysisTasks().map(t => t.id))
  const logs = getLogs()
  const filteredLogs = logs.filter(l => !analysisIds.has(l.taskId))
  store.set('analysisTasks', [])
  store.set('logs', filteredLogs)
}

/** 清除所有产品原型项目 */
export function clearAllProjects(): void {
  const projectIds = new Set(getProjects().map(p => p.id))
  const logs = getLogs()
  const filteredLogs = logs.filter(l => !projectIds.has(l.taskId))
  store.set('projects', [])
  store.set('logs', filteredLogs)
}

/** 清除所有设计文档 */
export function clearAllDesignDocs(): void {
  const docIds = new Set(getDesignDocs().map(d => d.id))
  const logs = getLogs()
  const filteredLogs = logs.filter(l => !docIds.has(l.taskId))
  store.set('designDocs', [])
  store.set('logs', filteredLogs)
}

/** 清除所有数据（全部重置） */
export function clearAllData(): void {
  store.set('projects', [])
  store.set('logs', [])
  store.set('analysisTasks', [])
  store.set('marketReports', [])
  store.set('designDocs', [])
}

export { store }
