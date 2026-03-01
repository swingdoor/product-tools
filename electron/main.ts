import { app, BrowserWindow, Menu, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { registerIpcHandlers } from './ipc'

// 是否是开发模式
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// 注册自定义协议权限（需在 app.ready 前调用）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'knowledge-file',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true  // 关键：允许绕过 CSP 限制加载本地文件
    }
  }
])

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
      webSecurity: true,
      webviewTag: true
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f0f2f5',
    show: false
  })

  // 注册 IPC 处理程序
  registerIpcHandlers(mainWindow)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools()
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

  // 1. 设置全局 CSP（在 app.ready 后设置，确保对所有窗口和 iframe 生效）
  const { session } = require('electron')
  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
    // 仅在主框架或我们的 iframe 加载时调整 CSP
    if (details.url.startsWith('http://localhost') || details.url.startsWith('file://')) {
      const responseHeaders = { ...details.responseHeaders }
      // 如果存在原有 CSP，则修改；如果不存在，则添加
      const cspKey = Object.keys(responseHeaders).find(k => k.toLowerCase() === 'content-security-policy') || 'Content-Security-Policy'

      responseHeaders[cspKey] = [
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://* data: blob: knowledge-file:; " +
        "frame-src 'self' knowledge-file: data: blob:; " +
        "object-src 'self' knowledge-file: data: blob:; " +
        "img-src 'self' data: blob: https://*; " +
        "connect-src 'self' http://localhost:* https://* ws://localhost:* wss://*"
      ]

      callback({ responseHeaders })
      return
    }
    callback({ responseHeaders: details.responseHeaders })
  })

  // 2. 注册自定义协议处理器：knowledge-file://local/{filename}
  // 这种方式解决了绝对路径暴露问题，且具有良好的移植性
  protocol.handle('knowledge-file', (request) => {
    const url = new URL(request.url)
    const filePath = join(app.getPath('userData'), 'knowledge', decodeURIComponent(url.pathname))
    return net.fetch(pathToFileURL(filePath).toString())
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
