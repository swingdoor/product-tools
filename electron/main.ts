import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'

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
      webSecurity: true
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
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
