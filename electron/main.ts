import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import { join, dirname } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import {
  getProjects,
  getProjectById,
  saveProject,
  deleteProject,
  getLogsByTaskId,
  addLog,
  updateProjectProgress,
  updateProjectStatusAndProgress,
  getAnalysisTasks,
  getAnalysisTaskById,
  saveAnalysisTask,
  deleteAnalysisTask,
  updateAnalysisTaskStatus,
  updateAnalysisTaskHeartbeat,
  getMarketReports,
  getMarketReportById,
  saveMarketReport,
  deleteMarketReport,
  updateMarketReportStatus,
  updateMarketReportHeartbeat,
  getDesignDocs,
  getDesignDocById,
  saveDesignDoc,
  deleteDesignDoc,
  updateDesignDocStatus,
  updateDesignDocProgress,
  clearAllMarketReports,
  clearAllAnalysisTasks,
  clearAllProjects,
  clearAllDesignDocs,
  type PrototypeProject,
  type TaskLog,
  type TaskLogType,
  type GenerateProgress,
  type TaskStatus,
  type AnalysisTask,
  type MarketReport,
  type DesignDoc,
  type DesignDocProgress
} from './store'

// 是否是开发模式
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// 获取图标路径
function getIconPath(): string | undefined {
  if (process.platform === 'win32') {
    // Windows 使用 .ico
    if (isDev) {
      return join(__dirname, '../build/icon.ico')
    }
    return join(process.resourcesPath, 'icon.ico')
  } else if (process.platform === 'darwin') {
    // macOS 使用 .icns
    return undefined // macOS 会自动使用 Info.plist 中的图标
  } else {
    // Linux 使用 .png
    if (isDev) {
      return join(__dirname, '../build/icon.png')
    }
    return join(process.resourcesPath, 'icon.png')
  }
}

let mainWindow: BrowserWindow | null = null

// ────────────────────────────────────────────────────────────
// 创建主窗口
// ────────────────────────────────────────────────────────────
function createWindow() {
  const iconPath = getIconPath()
  
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f0f2f5',
    show: false
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)  // 去掉默认菜单栏
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ────────────────────────────────────────────────────────────
// IPC: AI 接口调用（流式 + 非流式）
// ────────────────────────────────────────────────────────────

/**
 * 调用 AI 接口（支持流式输出，通过事件逐步回传渲染进程）
 * channel: ai:call
 * params: { type, payload, apiKey, baseUrl, model, systemPrompt }
 */
ipcMain.handle('ai:call', async (event, params: AICallParams) => {
  const { type, payload, apiKey, baseUrl, model, systemPrompt } = params

  // 构造不同类型的 prompt
  const prompt = buildPrompt(type, payload)

  // 构造 messages 数组
  const messages = [
    { role: 'user', content: prompt }
  ]

  // 只有当 systemPrompt 存在时才添加 system 消息
  // 并且放在 user 消息之前
  if (systemPrompt && systemPrompt.trim()) {
    messages.unshift({
      role: 'system',
      content: systemPrompt
    })
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-reasoner',
        messages: messages,
        stream: true,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`API请求失败: ${response.status} - ${errText}`)
    }

    // 流式读取，实时推送到渲染进程
    const reader = response.body?.getReader()
    const decoder = new TextDecoder('utf-8')
    let fullContent = ''

    if (!reader) throw new Error('无法获取响应流')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content || ''
            if (delta) {
              fullContent += delta
              // 实时推送增量内容到渲染进程
              event.sender.send('ai:stream-chunk', { chunk: delta, type })
            }
          } catch {
            // 忽略 JSON 解析错误
          }
        }
      }
    }

    // 推送完成信号
    event.sender.send('ai:stream-done', { content: fullContent, type })
    return { success: true, content: fullContent }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知错误'
    event.sender.send('ai:stream-error', { error: message, type })
    return { success: false, error: message }
  }
})

// ────────────────────────────────────────────────────────────
// IPC: 文件导出
// ────────────────────────────────────────────────────────────

/** 保存文件对话框，返回路径 */
ipcMain.handle('file:save-dialog', async (_event, options: SaveDialogOptions) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: options.title || '保存文件',
    defaultPath: options.defaultPath || 'export',
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }]
  })
  return result
})

/** 将内容写入文件 */
ipcMain.handle('file:write', async (_event, { filePath, content }: { filePath: string; content: string }) => {
  try {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
    await writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '写入文件失败'
    return { success: false, error: message }
  }
})

/** 用系统默认应用打开文件 */
ipcMain.handle('file:open', async (_event, filePath: string) => {
  await shell.openPath(filePath)
})

/** 打开外部链接 */
ipcMain.handle('shell:open-external', async (_event, url: string) => {
  await shell.openExternal(url)
})

// ────────────────────────────────────────────────────────────
// IPC: 数据库操作（electron-store）
// ────────────────────────────────────────────────────────────

/** 获取所有项目 */
ipcMain.handle('db:get-projects', async () => {
  try {
    return { success: true, data: getProjects() }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '获取项目列表失败'
    return { success: false, error: message }
  }
})

/** 获取单个项目 */
ipcMain.handle('db:get-project', async (_event, id: string) => {
  try {
    const project = getProjectById(id)
    return { success: true, data: project }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '获取项目失败'
    return { success: false, error: message }
  }
})

/** 保存项目（新增或更新） */
ipcMain.handle('db:save-project', async (_event, project: PrototypeProject) => {
  try {
    const saved = saveProject(project)
    return { success: true, data: saved }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '保存项目失败'
    return { success: false, error: message }
  }
})

/** 删除项目 */
ipcMain.handle('db:delete-project', async (_event, id: string) => {
  try {
    const result = deleteProject(id)
    return { success: true, data: result }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '删除项目失败'
    return { success: false, error: message }
  }
})

/** 获取项目日志 */
ipcMain.handle('db:get-logs', async (_event, taskId: string) => {
  try {
    const logs = getLogsByTaskId(taskId)
    return { success: true, data: logs }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '获取日志失败'
    return { success: false, error: message }
  }
})

/** 添加日志 */
ipcMain.handle('db:add-log', async (_event, log: Omit<TaskLog, 'id'>) => {
  try {
    const newLog = addLog(log)
    return { success: true, data: newLog }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '添加日志失败'
    return { success: false, error: message }
  }
})

/** 更新项目进度 */
ipcMain.handle('db:update-progress', async (_event, { id, progress }: { id: string; progress: Partial<GenerateProgress> }) => {
  try {
    const project = updateProjectProgress(id, progress)
    return { success: true, data: project }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '更新进度失败'
    return { success: false, error: message }
  }
})

/** 更新项目状态和进度 */
ipcMain.handle('db:update-status-progress', async (_event, { id, status, progress, errorMessage }: { 
  id: string; 
  status: TaskStatus; 
  progress?: Partial<GenerateProgress>;
  errorMessage?: string 
}) => {
  try {
    const project = updateProjectStatusAndProgress(id, status, progress, errorMessage)
    return { success: true, data: project }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '更新状态失败'
    return { success: false, error: message }
  }
})

// ────────────────────────────────────────────────────────────
// 任务管理器（后端统一管理任务状态、心跳检测）
// ────────────────────────────────────────────────────────────

// 心跳间隔（5秒）
const HEARTBEAT_INTERVAL_MS = 5 * 1000
// 心跳超时时间（30秒）
const HEARTBEAT_TIMEOUT_MS = 30 * 1000
// 任务管理器检查间隔（5秒）
const TASK_CHECK_INTERVAL_MS = 5 * 1000

/** 任务状态 */
interface TaskState {
  projectId: string
  cancelled: boolean
  startTime: number
}

/** 任务管理器：管理所有运行中的任务，统一检测心跳超时 */
class TaskManager {
  private runningTasks = new Map<string, TaskState>()
  private checkTimer: ReturnType<typeof setInterval> | null = null
  
  constructor() {
    // 启动全局心跳检测定时器
    this.startHeartbeatChecker()
  }
  
  /** 启动心跳检测定时器 */
  private startHeartbeatChecker() {
    if (this.checkTimer) return
    this.checkTimer = setInterval(() => this.checkAllTasksHeartbeat(), TASK_CHECK_INTERVAL_MS)
    console.log('[TaskManager] 心跳检测器已启动')
  }
  
  /** 检查所有任务的心跳 */
  private checkAllTasksHeartbeat() {
    // 获取所有 generating 状态的项目
    const projects = getProjects()
    const generatingProjects = projects.filter(p => p.status === 'generating')
    
    for (const project of generatingProjects) {
      const taskState = this.runningTasks.get(project.id)
      
      // 如果任务在本进程运行中，不检查超时（任务会自己更新心跳）
      if (taskState && !taskState.cancelled) {
        continue
      }
      
      // 检查心跳是否超时
      const lastHeartbeat = project.progress?.lastHeartbeat
      if (!lastHeartbeat) {
        // 无心跳记录，标记失败
        this.markTaskAsFailed(project.id, '后台任务异常中断（无心跳记录）')
        continue
      }
      
      const elapsed = Date.now() - new Date(lastHeartbeat).getTime()
      if (elapsed > HEARTBEAT_TIMEOUT_MS) {
        const timeoutSec = Math.floor(elapsed / 1000)
        this.markTaskAsFailed(project.id, `后台任务已超时 ${timeoutSec} 秒无响应，判定为失败`)
      }
    }
  }
  
  /** 标记任务失败 */
  private markTaskAsFailed(projectId: string, reason: string) {
    console.log(`[TaskManager] 任务超时: ${projectId}, 原因: ${reason}`)
    updateProjectStatusAndProgress(projectId, 'failed', { step: 'error', errorMessage: reason }, reason)
    addLog({ taskId: projectId, type: 'error', message: reason, timestamp: new Date().toISOString() })
    this.runningTasks.delete(projectId)
  }
  
  /** 注册任务 */
  registerTask(projectId: string): TaskState {
    const state: TaskState = {
      projectId,
      cancelled: false,
      startTime: Date.now()
    }
    this.runningTasks.set(projectId, state)
    return state
  }
  
  /** 取消任务 */
  cancelTask(projectId: string): boolean {
    const state = this.runningTasks.get(projectId)
    if (state) {
      state.cancelled = true
      this.runningTasks.delete(projectId)
      return true
    }
    return false
  }
  
  /** 任务完成，注销 */
  unregisterTask(projectId: string) {
    this.runningTasks.delete(projectId)
  }
  
  /** 检查任务是否在运行 */
  isTaskRunning(projectId: string): boolean {
    return this.runningTasks.has(projectId)
  }
  
  /** 获取任务状态 */
  getTaskState(projectId: string): TaskState | undefined {
    return this.runningTasks.get(projectId)
  }
}

// 全局任务管理器实例
const taskManager = new TaskManager()

// ────────────────────────────────────────────────────────────
// IPC: 任务执行服务
// ────────────────────────────────────────────────────────────

/** 启动原型生成任务（后端执行） */
ipcMain.handle('task:start-generate', async (_event, { projectId, apiKey, baseUrl, model }: {
  projectId: string
  apiKey: string
  baseUrl: string
  model?: string
}) => {
  // 检查任务是否已在运行
  if (taskManager.isTaskRunning(projectId)) {
    return { success: false, error: '任务已在运行中' }
  }
  
  // 获取项目信息
  const project = getProjectById(projectId)
  if (!project) {
    return { success: false, error: '项目不存在' }
  }
  
  const content = project.analysisContent?.trim()
  if (!content) {
    return { success: false, error: '任务需求描述为空' }
  }
  
  // 注册任务
  const taskState = taskManager.registerTask(projectId)
  
  // 先同步更新状态为生成中（包含初始心跳），确保前端刷新时能拿到正确状态
  updateProjectStatusAndProgress(projectId, 'generating', {
    step: 'plan',
    totalPages: 0,
    currentPage: 0,
    currentPageName: '',
    completedPages: [],
    errorMessage: undefined,
    lastHeartbeat: new Date().toISOString()
  })
  addLog({ taskId: projectId, type: 'generate_start', message: '开始生成原型', timestamp: new Date().toISOString() })
  addLog({ taskId: projectId, type: 'status_change', message: '状态变更: → 生成中', timestamp: new Date().toISOString() })
  
  // 异步执行任务（不等待完成）
  executeGenerateTask(projectId, content, project.clientType || 'Web端', apiKey, baseUrl, model, taskState)
    .catch(err => console.error('任务执行异常:', err))
    .finally(() => taskManager.unregisterTask(projectId))
  
  return { success: true }
})

/** 取消任务 */
ipcMain.handle('task:cancel', async (_event, projectId: string) => {
  if (taskManager.cancelTask(projectId)) {
    updateProjectStatusAndProgress(projectId, 'pending', { step: 'idle' })
    addLog({ taskId: projectId, type: 'status_change', message: '用户取消生成', timestamp: new Date().toISOString() })
    return { success: true }
  }
  return { success: false, error: '任务不存在或已完成' }
})

/** 执行生成任务（主进程内部） */
async function executeGenerateTask(
  projectId: string,
  analysisContent: string,
  clientType: string,
  apiKey: string,
  baseUrl: string,
  model: string | undefined,
  taskState: TaskState
) {
  // 注：状态已在 task:start-generate 中同步更新，这里直接开始执行
  
  try {
    // 第一步：规划页面
    addLog({ taskId: projectId, type: 'generate_step', message: '步骤1：正在规划页面架构...', timestamp: new Date().toISOString() })
    const planRaw = await callAIWithHeartbeat(
      'prototype-plan',
      { analysisContent, clientType },
      apiKey, baseUrl, model,
      projectId, taskState
    )
    
    if (taskState.cancelled) return
    
    // 解析规划结果
    const planData = parseJSON<{ appName: string; clientType: string; pages: { id: string; name: string; description: string }[] }>(planRaw)
    if (!planData?.pages?.length) throw new Error('页面规划解析失败，请重试')
    
    const { appName, pages: plannedPages } = planData
    
    // 更新进度
    updateProjectProgress(projectId, {
      step: 'pages',
      totalPages: plannedPages.length,
      currentPage: 0,
      lastHeartbeat: new Date().toISOString()
    })
    addLog({ taskId: projectId, type: 'generate_step', message: `页面规划完成，共 ${plannedPages.length} 个页面`, detail: plannedPages.map(p => p.name).join('、'), timestamp: new Date().toISOString() })
    
    // 第二步：逐页生成 HTML
    const generatedPages: Array<{ id: string; name: string; description: string; prompt: string; htmlContent: string }> = []
    const completedPages: Array<{ id: string; name: string }> = []
    
    for (let i = 0; i < plannedPages.length; i++) {
      if (taskState.cancelled) return
      
      const page = plannedPages[i]
      
      // 更新当前生成进度
      updateProjectProgress(projectId, {
        currentPage: i + 1,
        currentPageName: page.name,
        lastHeartbeat: new Date().toISOString()
      })
      addLog({ taskId: projectId, type: 'generate_step', message: `步骤2：正在生成页面 ${i + 1}/${plannedPages.length}：${page.name}`, timestamp: new Date().toISOString() })
      
      const htmlRaw = await callAIWithHeartbeat(
        'prototype-page',
        { appName, page, clientType, pageIndex: i, totalPages: plannedPages.length },
        apiKey, baseUrl, model,
        projectId, taskState
      )
      
      if (taskState.cancelled) return
      
      // 提取 HTML
      let htmlContent = htmlRaw
      const htmlMatch = htmlRaw.match(/```html\s*([\s\S]*?)\s*```/)
      if (htmlMatch) htmlContent = htmlMatch[1]
      
      generatedPages.push({
        id: page.id,
        name: page.name,
        description: page.description,
        prompt: `生成${page.name}页面`,
        htmlContent
      })
      
      completedPages.push({ id: page.id, name: page.name })
      
      // 更新已完成页面列表
      updateProjectProgress(projectId, {
        completedPages: [...completedPages],
        lastHeartbeat: new Date().toISOString()
      })
      addLog({ taskId: projectId, type: 'generate_step', message: `页面「${page.name}」生成完成`, timestamp: new Date().toISOString() })
    }
    
    // 保存结果
    const project = getProjectById(projectId)
    if (project) {
      project.data = { appName, clientType, pages: generatedPages }
      project.status = 'completed'
      project.progress = { step: 'done', totalPages: generatedPages.length, currentPage: generatedPages.length, currentPageName: '', completedPages, lastHeartbeat: new Date().toISOString() }
      project.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
      saveProject(project)
    }
    
    addLog({ taskId: projectId, type: 'status_change', message: '状态变更: → 已完成', timestamp: new Date().toISOString() })
    addLog({ taskId: projectId, type: 'generate_done', message: `生成完成，共 ${generatedPages.length} 个页面`, timestamp: new Date().toISOString() })
    
  } catch (err) {
    if (taskState.cancelled) return
    const errMsg = err instanceof Error ? err.message : '生成失败，请重试'
    updateProjectStatusAndProgress(projectId, 'failed', { step: 'error', errorMessage: errMsg }, errMsg)
    addLog({ taskId: projectId, type: 'status_change', message: '状态变更: → 失败', timestamp: new Date().toISOString() })
    addLog({ taskId: projectId, type: 'error', message: `生成失败: ${errMsg}`, timestamp: new Date().toISOString() })
  }
}

/** 调用 AI（带心跳更新） */
async function callAIWithHeartbeat(
  type: AIType,
  payload: Record<string, unknown>,
  apiKey: string,
  baseUrl: string,
  model: string | undefined,
  projectId: string,
  taskState: TaskState
): Promise<string> {
  const prompt = buildPrompt(type, payload)
  
  // 启动心跳定时器
  const heartbeatTimer = setInterval(() => {
    if (!taskState.cancelled) {
      updateProjectProgress(projectId, { lastHeartbeat: new Date().toISOString() })
    }
  }, HEARTBEAT_INTERVAL_MS)
  
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-reasoner',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        temperature: 0.7
      })
    })
    
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`API请求失败: ${response.status} - ${errText}`)
    }
    
    const reader = response.body?.getReader()
    const decoder = new TextDecoder('utf-8')
    let fullContent = ''
    
    if (!reader) throw new Error('无法获取响应流')
    
    while (true) {
      if (taskState.cancelled) {
        reader.cancel()
        throw new Error('任务已取消')
      }
      
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content || ''
            if (delta) fullContent += delta
          } catch {
            // 忽略 JSON 解析错误
          }
        }
      }
    }
    
    return fullContent
  } finally {
    clearInterval(heartbeatTimer)
  }
}

/** 解析 JSON */
function parseJSON<T>(text: string): T | null {
  try {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/)
    if (match) {
      const jsonStr = match[1] || match[0]
      return JSON.parse(jsonStr) as T
    }
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

// ────────────────────────────────────────────────────────────
// Prompt 构造工具函数
// ────────────────────────────────────────────────────────────

type AIType = 'market-insight' | 'product-analysis' | 'product-prototype' | 'prototype-plan' | 'prototype-page'

interface AICallParams {
  type: AIType
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

/*
function getSystemPrompt(type: AIType): string {
  const prompts: Record<AIType, string> = {
    'market-insight': `你是一位资深市场分析专家，拥有丰富的行业研究经验。你的任务是根据用户提供的行业信息，生成详尽、专业的市场洞察报告。报告须包含市场规模、竞争格局、用户痛点、技术趋势、政策导向等维度，使用Markdown格式输出，结构清晰，数据有支撑，分析有深度。`,
    'product-analysis': `你是一位资深产品经理，擅长从市场报告中提炼产品需求、制定产品策略。你的任务是基于市场洞察报告，生成结构化的产品需求分析方案，包含产品定位、需求清单（优先级排序）、功能模块、差异化优势、设计方案和可行性分析。使用Markdown格式输出，需求清单以表格形式呈现。`,
    'product-prototype': `你是一位资深UX设计师，专注于产品原型设计。你的任务是根据产品需求分析方案，生成高保真、结构丰富的产品原型JSON数据。`,
    'prototype-plan': `你是一位资深UX设计师，擅长根据产品需求规划产品的完整页面架构。你的任务是分析产品需求，规划需要设计哪些页面，并为每个页面提供详细的内容描述。请直接输出纯 JSON，不要包含 Markdown 标记（如 \`\`\`json ... \`\`\`）或其他解释性文字。`,
    'prototype-page': `你是一位资深UX设计师，专注于产品原型精确设计。你的任务是根据给定的页面描述，生成该页面完整的原型JSON数据。请直接输出纯 JSON，不要包含 Markdown 标记（如 \`\`\`json ... \`\`\`）或其他解释性文字。`
  }
  return prompts[type] || ''
}
*/

function buildPrompt(type: AIType, payload: Record<string, unknown>): string {
  switch (type) {
    case 'market-insight': {
      const { industry, targetUsers, focusAreas, dataSources } = payload as {
        industry: string
        targetUsers?: string
        focusAreas?: string[]
        dataSources?: string
      }
      const focusStr = focusAreas?.length ? `\n- 核心关注方向：${focusAreas.join('、')}` : ''
      const targetStr = targetUsers ? `\n- 目标用户群体：${targetUsers}` : ''
      const dataStr = dataSources ? `\n- 参考数据源：\n${dataSources}` : ''
      return `请为以下行业生成一份详细的市场洞察报告：\n- 行业/领域：${industry}${targetStr}${focusStr}${dataStr}\n\n报告要求：结构完整、数据详实、分析深入，使用Markdown格式，包含执行摘要、各维度详细分析和战略建议。`
    }
    case 'product-analysis': {
      const { reportContent } = payload as { reportContent: string }
      return `基于以下市场洞察报告，请生成详细的产品需求分析方案：\n\n${reportContent}\n\n分析要求：请按以下结构输出（使用Markdown格式）：\n1. **产品定位**：目标用户、核心价值、差异化定位\n2. **需求清单**：以表格形式列出（优先级P0/P1/P2、需求描述、用户场景、价值点）\n3. **功能模块**：核心功能架构和模块划分\n4. **差异化优势**：相比竞品的核心差异点\n5. **设计方案**：关键交互设计和用户体验要点\n6. **可行性分析**：技术可行性、商业可行性、风险评估`
    }
    case 'product-prototype': {
      const { analysisContent } = payload as { analysisContent: string }
      return `基于以下产品需求分析方案，生成完整的产品原型JSON数据：\n\n${analysisContent}\n\n只输出纯JSON。`
    }
    case 'prototype-plan': {
      const { analysisContent, clientType } = payload as { analysisContent: string; clientType: string }
      const canvasInfo = getCanvasInfoByClientType(clientType)
      return `基于以下产品需求分析方案，规划产品原型的页面架构：

${analysisContent}

【客户端类型】：${clientType}
【画布规格】：${canvasInfo.desc}

请分析产品需求，规划需要设计的完整页面列表，并为每个页面提供详细描述。

输出格式（严格JSON）：
{
  "appName": "应用名称",
  "clientType": "${clientType}",
  "pages": [
    {
      "id": "page_home",
      "name": "首页",
      "description": "详细描述..."
    }
  ]
}`
    }
    case 'prototype-page': {
      const { appName, page, clientType, pageIndex, totalPages, customPrompt } = payload as {
        appName?: string
        page?: { id: string; name: string; description: string }
        clientType?: string
        pageIndex?: number
        totalPages?: number
        customPrompt?: string
      }
      
      // 如果有自定义提示词，直接使用
      if (customPrompt) {
        return customPrompt
      }
      
      // 否则使用默认模板（需要完整参数）
      if (!appName || !page || !clientType || pageIndex === undefined || totalPages === undefined) {
        return '请提供完整的页面信息'
      }
      
      const canvasInfo = getCanvasInfoByClientType(clientType)
      return `为产品“${appName}”生成第 ${pageIndex + 1}/${totalPages} 个页面的完整 HTML 代码。

【页面信息】
- 页面名称：${page.name}
- 页面描述：${page.description}

【客户端类型】：${clientType}
【页面尺寸】：${canvasInfo.width}×${canvasInfo.height}px

【设计规范】：
- 主色：#165DFF，背景：#F5F7FA，卡片：#FFFFFF，主文字：#1D2129，次文字：#4E5969
- 统一字体：-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- 圆角：8px，阴影：0 2px 8px rgba(0,0,0,0.08)
${canvasInfo.layoutGuide}

【输出要求】：
1. 生成完整的 HTML 文件，包含 <!DOCTYPE html>、<html>、<head>、<body>
2. 所有样式写在 <style> 标签内，不使用外部 CSS
3. 使用语义化 HTML5 标签（header, nav, main, section, footer 等）
4. 页面内容完整，包含所有描述中的功能区域
5. 使用占位符图片（绘制矩形+文字提示）
6. 添加 hover 状态、过渡动画提升交互体验
7. 页面底部添加导航链接到其他页面（使用 # + 页面名称作为 href）

只输出 HTML 代码，不要包含任何解释或 markdown 标记。`
    }
    default:
      return ''
  }
}

/** 根据客户端类型返回画布信息 */
function getCanvasInfoByClientType(clientType: string): { width: number; height: number; desc: string; layoutGuide: string } {
  switch (clientType) {
    case '移动端（iOS/Android）':
      return {
        width: 390,
        height: 844,
        desc: '390×844px（iPhone 14标准尺寸）',
        layoutGuide: '- 布局特点：顶部状态栏44px，底部导航栏83px，内容区竖向排列，全宽组件'
      }
    case '平板端（iPad）':
      return {
        width: 1024,
        height: 1366,
        desc: '1024×1366px（iPad Pro 12.9寸）',
        layoutGuide: '- 布局特点：可使用分栏布局，左侧导航200px，右侧内容区'
      }
    case '桌面客户端':
      return {
        width: 1440,
        height: 900,
        desc: '1440×900px（标准桌面端）',
        layoutGuide: '- 布局特点：顶部导航栏60px，左侧侧边栏220px，主内容区，右侧属性栏（可选）'
      }
    case '小程序':
      return {
        width: 375,
        height: 812,
        desc: '375×812px（微信小程序标准尺寸）',
        layoutGuide: '- 布局特点：顶部自定义导航44px，底部tabbar50px，内容区竖向排列'
      }
    case 'Web端':
    default:
      return {
        width: 1280,
        height: 900,
        desc: '1280×900px（标准Web端）',
        layoutGuide: '- 布局特点：顶部导航栏60px，左侧侧边栏220px，主内容区填充剩余宽度'
      }
  }
}

// ────────────────────────────────────────────────────────────
// IPC: 需求分析任务操作
// ────────────────────────────────────────────────────────────

/** 获取所有分析任务 */
ipcMain.handle('analysis:get-tasks', async () => {
  try {
    return { success: true, data: getAnalysisTasks() }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '获取任务列表失败'
    return { success: false, error: message }
  }
})

/** 获取单个分析任务 */
ipcMain.handle('analysis:get-task', async (_event, id: string) => {
  try {
    const task = getAnalysisTaskById(id)
    return { success: true, data: task }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '获取任务失败'
    return { success: false, error: message }
  }
})

/** 保存分析任务 */
ipcMain.handle('analysis:save-task', async (_event, task: AnalysisTask) => {
  try {
    const saved = saveAnalysisTask(task)
    return { success: true, data: saved }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '保存任务失败'
    return { success: false, error: message }
  }
})

/** 删除分析任务 */
ipcMain.handle('analysis:delete-task', async (_event, id: string) => {
  try {
    // 先取消运行中的任务
    taskManager.cancelTask(id)
    const result = deleteAnalysisTask(id)
    return { success: true, data: result }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '删除任务失败'
    return { success: false, error: message }
  }
})

/** 获取分析任务日志 */
ipcMain.handle('analysis:get-logs', async (_event, taskId: string) => {
  try {
    const logs = getLogsByTaskId(taskId)
    return { success: true, data: logs }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '获取日志失败'
    return { success: false, error: message }
  }
})

/** 启动分析任务 */
ipcMain.handle('analysis:start', async (_event, { taskId, apiKey, baseUrl, model }: {
  taskId: string
  apiKey: string
  baseUrl: string
  model?: string
}) => {
  // 检查任务是否已在运行
  if (taskManager.isTaskRunning(taskId)) {
    return { success: false, error: '任务已在运行中' }
  }
  
  // 获取任务信息
  const task = getAnalysisTaskById(taskId)
  if (!task) {
    return { success: false, error: '任务不存在' }
  }
  
  if (!task.inputContent?.trim()) {
    return { success: false, error: '分析内容为空' }
  }
  
  // 注册任务
  const taskState = taskManager.registerTask(taskId)
  
  // 同步更新状态为生成中
  updateAnalysisTaskStatus(taskId, 'generating', {
    progress: { lastHeartbeat: new Date().toISOString() }
  })
  addLog({ taskId, type: 'generate_start', message: '开始分析', timestamp: new Date().toISOString() })
  
  // 异步执行任务
  executeAnalysisTask(taskId, task.inputContent, apiKey, baseUrl, model, taskState)
    .catch(err => console.error('分析任务执行异常:', err))
    .finally(() => taskManager.unregisterTask(taskId))
  
  return { success: true }
})

/** 取消分析任务 */
ipcMain.handle('analysis:cancel', async (_event, taskId: string) => {
  if (taskManager.cancelTask(taskId)) {
    updateAnalysisTaskStatus(taskId, 'pending')
    addLog({ taskId, type: 'status_change', message: '用户取消分析', timestamp: new Date().toISOString() })
    return { success: true }
  }
  return { success: false, error: '任务不存在或已完成' }
})

/** 执行分析任务 */
async function executeAnalysisTask(
  taskId: string,
  inputContent: string,
  apiKey: string,
  baseUrl: string,
  model: string | undefined,
  taskState: TaskState
) {
  try {
    addLog({ taskId, type: 'generate_step', message: '正在分析产品需求...', timestamp: new Date().toISOString() })
    
    // 调用 AI 分析
    const result = await callAnalysisAIWithHeartbeat(
      inputContent, apiKey, baseUrl, model, taskId, taskState
    )
    
    if (taskState.cancelled) return
    
    // 保存结果
    updateAnalysisTaskStatus(taskId, 'completed', {
      resultContent: result,
      progress: { lastHeartbeat: new Date().toISOString() }
    })
    
    addLog({ taskId, type: 'generate_done', message: '分析完成', timestamp: new Date().toISOString() })
    
  } catch (err) {
    if (taskState.cancelled) return
    const errMsg = err instanceof Error ? err.message : '分析失败，请重试'
    updateAnalysisTaskStatus(taskId, 'failed', { errorMessage: errMsg })
    addLog({ taskId, type: 'error', message: `分析失败: ${errMsg}`, timestamp: new Date().toISOString() })
  }
}

/** 调用 AI 分析（带心跳） */
async function callAnalysisAIWithHeartbeat(
  inputContent: string,
  apiKey: string,
  baseUrl: string,
  model: string | undefined,
  taskId: string,
  taskState: TaskState
): Promise<string> {
  const prompt = `基于以下市场洞察报告，请生成详细的产品需求分析方案：

${inputContent}

分析要求：请按以下结构输出（使用Markdown格式）：
1. **产品定位**：目标用户、核心价值、差异化定位
2. **需求清单**：以表格形式列出（优先级P0/P1/P2、需求描述、用户场景、价值点）
3. **功能模块**：核心功能架构和模块划分
4. **差异化优势**：相比竞品的核心差异点
5. **设计方案**：关键交互设计和用户体验要点
6. **可行性分析**：技术可行性、商业可行性、风险评估`
  
  // 启动心跳定时器
  const heartbeatTimer = setInterval(() => {
    if (!taskState.cancelled) {
      updateAnalysisTaskHeartbeat(taskId)
    }
  }, HEARTBEAT_INTERVAL_MS)
  
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-reasoner',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        temperature: 0.7
      })
    })
    
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`API请求失败: ${response.status} - ${errText}`)
    }
    
    const reader = response.body?.getReader()
    const decoder = new TextDecoder('utf-8')
    let fullContent = ''
    
    if (!reader) throw new Error('无法获取响应流')
    
    while (true) {
      if (taskState.cancelled) {
        reader.cancel()
        throw new Error('任务已取消')
      }
      
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content || ''
            if (delta) fullContent += delta
          } catch {
            // 忽略 JSON 解析错误
          }
        }
      }
    }
    
    return fullContent
  } finally {
    clearInterval(heartbeatTimer)
  }
}

// ────────────────────────────────────────────────────────────────
// IPC: 市场报告任务管理
// ────────────────────────────────────────────────────────────────

/** 获取所有市场报告 */
ipcMain.handle('market:get-reports', async () => {
  try {
    const reports = getMarketReports()
    return { success: true, data: reports }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

/** 获取单个市场报告 */
ipcMain.handle('market:get-report', async (_event, id: string) => {
  try {
    const report = getMarketReportById(id)
    return { success: true, data: report }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

/** 保存市场报告 */
ipcMain.handle('market:save-report', async (_event, report: MarketReport) => {
  try {
    const saved = saveMarketReport(report)
    return { success: true, data: saved }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

/** 删除市场报告 */
ipcMain.handle('market:delete-report', async (_event, id: string) => {
  try {
    const result = deleteMarketReport(id)
    return { success: result, data: result }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

/** 获取市场报告日志 */
ipcMain.handle('market:get-logs', async (_event, taskId: string) => {
  try {
    const logs = getLogsByTaskId(taskId)
    return { success: true, data: logs }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

/** 启动市场报告生成任务 */
ipcMain.handle('market:start', async (_event, { reportId, apiKey, baseUrl, model }: {
  reportId: string
  apiKey: string
  baseUrl: string
  model?: string
}) => {
  // 检查任务是否已在运行
  if (taskManager.isTaskRunning(reportId)) {
    return { success: false, error: '任务已在运行中' }
  }
  
  // 获取报告信息
  const report = getMarketReportById(reportId)
  if (!report) {
    return { success: false, error: '报告不存在' }
  }
  
  if (!report.industry?.trim()) {
    return { success: false, error: '行业领域不能为空' }
  }
  
  // 注册任务
  const taskState = taskManager.registerTask(reportId)
  
  // 同步更新状态为生成中
  updateMarketReportStatus(reportId, 'generating', {
    progress: { lastHeartbeat: new Date().toISOString() }
  })
  addLog({ taskId: reportId, type: 'generate_start', message: '开始生成市场报告', timestamp: new Date().toISOString() })
  
  // 异步执行任务
  executeMarketTask(reportId, report, apiKey, baseUrl, model, taskState)
    .catch(err => console.error('市场报告生成异常:', err))
    .finally(() => taskManager.unregisterTask(reportId))
  
  return { success: true }
})

/** 取消市场报告任务 */
ipcMain.handle('market:cancel', async (_event, reportId: string) => {
  if (taskManager.cancelTask(reportId)) {
    updateMarketReportStatus(reportId, 'pending')
    addLog({ taskId: reportId, type: 'status_change', message: '用户取消生成', timestamp: new Date().toISOString() })
    return { success: true }
  }
  return { success: false, error: '任务不存在或已完成' }
})

/** 执行市场报告生成任务 */
async function executeMarketTask(
  reportId: string,
  report: MarketReport,
  apiKey: string,
  baseUrl: string,
  model: string | undefined,
  taskState: TaskState
) {
  try {
    addLog({ taskId: reportId, type: 'generate_step', message: '正在分析市场数据...', timestamp: new Date().toISOString() })
    
    // 调用 AI 生成报告
    const result = await callMarketAIWithHeartbeat(
      report, apiKey, baseUrl, model, reportId, taskState
    )
    
    if (taskState.cancelled) return
    
    // 保存结果
    updateMarketReportStatus(reportId, 'completed', {
      resultContent: result,
      progress: { lastHeartbeat: new Date().toISOString() }
    })
    
    addLog({ taskId: reportId, type: 'generate_done', message: '报告生成完成', timestamp: new Date().toISOString() })
    
  } catch (err) {
    if (taskState.cancelled) return
    const errMsg = err instanceof Error ? err.message : '生成失败，请重试'
    updateMarketReportStatus(reportId, 'failed', { errorMessage: errMsg })
    addLog({ taskId: reportId, type: 'error', message: `生成失败: ${errMsg}`, timestamp: new Date().toISOString() })
  }
}

/** 调用 AI 生成市场报告（带心跳） */
async function callMarketAIWithHeartbeat(
  report: MarketReport,
  apiKey: string,
  baseUrl: string,
  model: string | undefined,
  reportId: string,
  taskState: TaskState
): Promise<string> {
  const focusAreasText = report.focusAreas.length > 0 ? report.focusAreas.join('、') : '无特定关注方向'
  const targetUsersText = report.targetUsers || '未指定'
  const dataSourcesText = report.dataSources || '无额外参考数据'
  
  const prompt = `你是一位资深市场分析师，请为以下行业生成一份专业的市场洞察报告。

行业领域：${report.industry}
目标用户：${targetUsersText}
关注方向：${focusAreasText}
参考数据：${dataSourcesText}

请按以下结构输出（使用 Markdown 格式）：

# ${report.industry} 市场洞察报告

## 1. 执行摘要
简要概述行业现状、关键发现和主要机会

## 2. 市场规模与趋势
- 市场规模估算
- 增长趋势分析
- 未来预测

## 3. 竞争格局
- 主要竞争者分析
- 市场份额分布
- 竞争优劣势对比

## 4. 目标用户分析
- 用户画像
- 需求痛点
- 用户行为特征

## 5. 机会与挑战
- 市场机会
- 潜在风险
- 进入壁垒

## 6. 建议与行动计划
- 短期行动建议
- 中长期战略规划

请确保内容专业、数据详实、分析深入。`
  
  // 启动心跳定时器
  const heartbeatTimer = setInterval(() => {
    if (!taskState.cancelled) {
      updateMarketReportHeartbeat(reportId)
    }
  }, HEARTBEAT_INTERVAL_MS)
  
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-reasoner',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        temperature: 0.7
      })
    })
    
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`API请求失败: ${response.status} - ${errText}`)
    }
    
    const reader = response.body?.getReader()
    const decoder = new TextDecoder('utf-8')
    let fullContent = ''
    
    if (!reader) throw new Error('无法获取响应流')
    
    while (true) {
      if (taskState.cancelled) {
        reader.cancel()
        throw new Error('任务已取消')
      }
      
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content || ''
            if (delta) fullContent += delta
          } catch {
            // 忽略 JSON 解析错误
          }
        }
      }
    }
    
    return fullContent
  } finally {
    clearInterval(heartbeatTimer)
  }
}

// ──────────────────────────────────────────────────────────────────
// IPC: 设计文档操作
// ──────────────────────────────────────────────────────────────────

/** 获取所有设计文档 */
ipcMain.handle('design:get-docs', async () => {
  try {
    const docs = getDesignDocs()
    return { success: true, data: docs }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

/** 获取单个设计文档 */
ipcMain.handle('design:get-doc', async (_event, id: string) => {
  try {
    const doc = getDesignDocById(id)
    return { success: true, data: doc }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

/** 保存设计文档 */
ipcMain.handle('design:save-doc', async (_event, doc: DesignDoc) => {
  try {
    const saved = saveDesignDoc(doc)
    return { success: true, data: saved }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

/** 删除设计文档 */
ipcMain.handle('design:delete-doc', async (_event, id: string) => {
  try {
    const result = deleteDesignDoc(id)
    return { success: result, data: result }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

/** 获取设计文档日志 */
ipcMain.handle('design:get-logs', async (_event, docId: string) => {
  try {
    const logs = getLogsByTaskId(docId)
    return { success: true, data: logs }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

/** 启动设计文档生成任务 */
ipcMain.handle('design:start', async (_event, { docId, apiKey, baseUrl, model }: {
  docId: string
  apiKey: string
  baseUrl: string
  model?: string
}) => {
  // 检查任务是否已在运行
  if (taskManager.isTaskRunning(docId)) {
    return { success: false, error: '任务已在运行中' }
  }
  
  // 获取文档信息
  const doc = getDesignDocById(docId)
  if (!doc) {
    return { success: false, error: '文档不存在' }
  }
  
  // 获取关联的原型项目
  const project = getProjectById(doc.sourceProjectId)
  if (!project) {
    return { success: false, error: '关联的原型项目不存在' }
  }
  
  if (!project.data?.pages || project.data.pages.length === 0) {
    return { success: false, error: '原型项目没有页面数据' }
  }
  
  // 注册任务
  const taskState = taskManager.registerTask(docId)
  
  // 同步更新状态为生成中
  updateDesignDocStatus(docId, 'generating', {
    progress: {
      totalPages: project.data.pages.length,
      currentPage: 0,
      currentPageName: '',
      percentage: 0,
      lastHeartbeat: new Date().toISOString()
    }
  })
  addLog({ taskId: docId, type: 'generate_start', message: '开始生成设计文档', timestamp: new Date().toISOString() })
  
  // 异步执行任务
  executeDesignDocTask(docId, doc, project, apiKey, baseUrl, model, taskState)
    .catch(err => console.error('设计文档生成异常:', err))
    .finally(() => taskManager.unregisterTask(docId))
  
  return { success: true }
})

/** 取消设计文档任务 */
ipcMain.handle('design:cancel', async (_event, docId: string) => {
  if (taskManager.cancelTask(docId)) {
    updateDesignDocStatus(docId, 'pending', {
      progress: { totalPages: 0, currentPage: 0, currentPageName: '', percentage: 0 }
    })
    addLog({ taskId: docId, type: 'status_change', message: '用户取消生成', timestamp: new Date().toISOString() })
    return { success: true }
  }
  return { success: false, error: '任务不存在或已完成' }
})

// ────────────────────────────────────────────────────────────
// 数据清除 IPC 处理器
// ────────────────────────────────────────────────────────────

ipcMain.handle('data:clear-market', async () => {
  try {
    clearAllMarketReports()
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('data:clear-analysis', async () => {
  try {
    clearAllAnalysisTasks()
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('data:clear-prototype', async () => {
  try {
    clearAllProjects()
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('data:clear-design', async () => {
  try {
    clearAllDesignDocs()
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

/** 执行设计文档生成任务 */
async function executeDesignDocTask(
  docId: string,
  doc: DesignDoc,
  project: PrototypeProject,
  apiKey: string,
  baseUrl: string,
  model: string | undefined,
  taskState: TaskState
) {
  const pages = project.data?.pages || []
  const totalPages = pages.length
  let resultContent = `# ${doc.title}\n\n> 基于原型项目「${project.title}」自动生成\n> 生成时间：${new Date().toISOString().replace('T', ' ').slice(0, 19)}\n\n---\n\n`
  
  try {
    for (let i = 0; i < totalPages; i++) {
      if (taskState.cancelled) return
      
      const page = pages[i]
      const currentPage = i + 1
      const percentage = Math.round((i / totalPages) * 100)
      
      // 更新进度
      updateDesignDocProgress(docId, {
        totalPages,
        currentPage,
        currentPageName: page.name,
        percentage,
        lastHeartbeat: new Date().toISOString()
      })
      
      addLog({ 
        taskId: docId, 
        type: 'generate_step', 
        message: `正在生成页面 ${currentPage}/${totalPages}: ${page.name}`,
        timestamp: new Date().toISOString()
      })
      
      // 生成单个页面的设计说明
      const pageDesign = await generatePageDesignWithHeartbeat(
        page, apiKey, baseUrl, model, docId, taskState
      )
      
      if (taskState.cancelled) return
      
      // 汇总到结果中
      resultContent += `## ${currentPage}. ${page.name}\n\n`
      resultContent += pageDesign
      resultContent += '\n\n---\n\n'
    }
    
    if (taskState.cancelled) return
    
    // 保存结果
    updateDesignDocStatus(docId, 'completed', {
      resultContent,
      progress: {
        totalPages,
        currentPage: totalPages,
        currentPageName: '',
        percentage: 100,
        lastHeartbeat: new Date().toISOString()
      }
    })
    
    addLog({ taskId: docId, type: 'generate_done', message: '设计文档生成完成', timestamp: new Date().toISOString() })
    
  } catch (err) {
    if (taskState.cancelled) return
    const errMsg = err instanceof Error ? err.message : '生成失败，请重试'
    updateDesignDocStatus(docId, 'failed', { errorMessage: errMsg })
    addLog({ taskId: docId, type: 'error', message: `生成失败: ${errMsg}`, timestamp: new Date().toISOString() })
  }
}

/** 生成单个页面的设计说明（带心跳） */
async function generatePageDesignWithHeartbeat(
  page: { name: string; description: string; htmlContent: string },
  apiKey: string,
  baseUrl: string,
  model: string | undefined,
  docId: string,
  taskState: TaskState
): Promise<string> {
  const prompt = `你是一位专业的产品设计师，请根据以下 HTML 页面代码，生成该页面的功能设计说明文档。

**页面名称**: ${page.name}
**页面描述**: ${page.description}

**HTML 代码**:
\`\`\`html
${page.htmlContent}
\`\`\`

请输出包含以下内容的 Markdown 格式文档：

### 页面概述
简要描述页面的主要用途和在产品中的位置

### 功能点清单
列出页面包含的所有功能点

### 交互逻辑说明
详细说明用户交互流程和各元素的交互行为

### 数据字段说明
列出页面涉及的数据字段及其类型、用途

### 异常状态处理
说明各种异常场景的处理方式

请确保内容专业、结构清晰、实用性强。`
  
  // 启动心跳定时器
  const heartbeatTimer = setInterval(() => {
    if (!taskState.cancelled) {
      updateDesignDocProgress(docId, {
        lastHeartbeat: new Date().toISOString()
      })
    }
  }, HEARTBEAT_INTERVAL_MS)
  
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-reasoner',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        temperature: 0.7
      })
    })
    
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`API请求失败: ${response.status} - ${errText}`)
    }
    
    const reader = response.body?.getReader()
    const decoder = new TextDecoder('utf-8')
    let fullContent = ''
    
    if (!reader) throw new Error('无法获取响应流')
    
    while (true) {
      if (taskState.cancelled) {
        reader.cancel()
        throw new Error('任务已取消')
      }
      
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content || ''
            if (delta) fullContent += delta
          } catch {
            // 忽略 JSON 解析错误
          }
        }
      }
    }
    
    return fullContent
  } finally {
    clearInterval(heartbeatTimer)
  }
}
