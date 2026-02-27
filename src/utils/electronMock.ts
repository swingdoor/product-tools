/**
 * 浏览器预览模式下，模拟 window.electronAPI
 * Electron 实际运行时由 preload.ts 注入真实 API
 */
if (typeof window !== 'undefined' && !window.electronAPI) {
  const noop = () => {}
  const resolveOk = () => Promise.resolve({ success: true })

  window.electronAPI = {
    aiCall: async (params) => {
      console.warn('[Mock] electronAPI.aiCall called', params)
      // 浏览器预览时模拟流式输出
      const mockChunks = [
        '# 模拟报告\n\n',
        '> ⚠️ 当前为**浏览器预览模式**，AI调用已模拟。\n\n',
        '## 说明\n\n',
        '在 Electron 桌面端运行时，将调用真实AI接口生成内容。\n\n',
        '请先在**设置页面**配置您的 API Key 和接口地址，',
        '然后通过 `npm run electron:dev` 启动桌面版。\n\n',
        '## 功能预览\n\n',
        '- ✅ 市场洞察报告生成\n',
        '- ✅ 产品需求分析\n',
        '- ✅ 产品原型可视化编辑\n',
      ]

      const type = params.type
      let fullContent = ''

      for (const chunk of mockChunks) {
        await new Promise(r => setTimeout(r, 80))
        fullContent += chunk
        window.dispatchEvent(new CustomEvent('__ai_stream_chunk', { detail: { chunk, type } }))
      }

      await new Promise(r => setTimeout(r, 200))
      window.dispatchEvent(new CustomEvent('__ai_stream_done', { detail: { content: fullContent, type } }))

      return { success: true, content: fullContent }
    },

    onAiStreamChunk: (cb) => {
      window.addEventListener('__ai_stream_chunk', (e: Event) => {
        cb((e as CustomEvent).detail)
      })
    },

    onAiStreamDone: (cb) => {
      window.addEventListener('__ai_stream_done', (e: Event) => {
        cb((e as CustomEvent).detail)
      })
    },

    onAiStreamError: (cb) => {
      window.addEventListener('__ai_stream_error', (e: Event) => {
        cb((e as CustomEvent).detail)
      })
    },

    removeAiListeners: noop,

    showSaveDialog: async () => ({ canceled: true }),

    writeFile: resolveOk,

    openFile: () => Promise.resolve(),

    openExternal: (url) => { window.open(url, '_blank'); return Promise.resolve() },

    // 数据库操作 Mock（浏览器模式使用 localStorage）
    dbGetProjects: async () => {
      try {
        const raw = localStorage.getItem('pt_prototypes')
        return { success: true, data: raw ? JSON.parse(raw) : [] }
      } catch {
        return { success: true, data: [] }
      }
    },

    dbGetProject: async (id: string) => {
      try {
        const raw = localStorage.getItem('pt_prototypes')
        const projects = raw ? JSON.parse(raw) : []
        return { success: true, data: projects.find((p: { id: string }) => p.id === id) }
      } catch {
        return { success: true, data: undefined }
      }
    },

    dbSaveProject: async (project) => {
      try {
        const raw = localStorage.getItem('pt_prototypes')
        const projects = raw ? JSON.parse(raw) : []
        const idx = projects.findIndex((p: { id: string }) => p.id === project.id)
        if (idx !== -1) {
          projects[idx] = project
        } else {
          projects.unshift(project)
        }
        localStorage.setItem('pt_prototypes', JSON.stringify(projects.slice(0, 50)))
        return { success: true, data: project }
      } catch {
        return { success: false, error: '保存失败' }
      }
    },

    dbDeleteProject: async (id: string) => {
      try {
        const raw = localStorage.getItem('pt_prototypes')
        const projects = raw ? JSON.parse(raw) : []
        const filtered = projects.filter((p: { id: string }) => p.id !== id)
        localStorage.setItem('pt_prototypes', JSON.stringify(filtered))
        return { success: true, data: true }
      } catch {
        return { success: false, error: '删除失败' }
      }
    },

    dbGetLogs: async () => {
      return { success: true, data: [] }
    },

    dbAddLog: async (log) => {
      return { success: true, data: { ...log, id: `log_${Date.now()}` } }
    },

    dbUpdateProgress: async (id: string, progress) => {
      try {
        const raw = localStorage.getItem('pt_prototypes')
        const projects = raw ? JSON.parse(raw) : []
        const project = projects.find((p: { id: string }) => p.id === id)
        if (project) {
          project.progress = { ...project.progress, ...progress }
          localStorage.setItem('pt_prototypes', JSON.stringify(projects))
          return { success: true, data: project }
        }
        return { success: false, error: '项目不存在' }
      } catch {
        return { success: false, error: '更新进度失败' }
      }
    },

    dbUpdateStatusProgress: async (id: string, status, progress, errorMessage) => {
      try {
        const raw = localStorage.getItem('pt_prototypes')
        const projects = raw ? JSON.parse(raw) : []
        const project = projects.find((p: { id: string }) => p.id === id)
        if (project) {
          project.status = status
          if (progress) project.progress = { ...project.progress, ...progress }
          if (errorMessage) project.errorMessage = errorMessage
          localStorage.setItem('pt_prototypes', JSON.stringify(projects))
          return { success: true, data: project }
        }
        return { success: false, error: '项目不存在' }
      } catch {
        return { success: false, error: '更新状态失败' }
      }
    },

    // 后台任务执行 Mock（浏览器模式不支持后台任务）
    taskStartGenerate: async () => {
      console.warn('[Mock] taskStartGenerate: 浏览器模式不支持后台任务执行')
      return { success: false, error: '请在 Electron 桌面端运行以使用完整功能' }
    },

    taskCancel: async () => {
      console.warn('[Mock] taskCancel: 浏览器模式不支持任务取消')
      return { success: false, error: '请在 Electron 桌面端运行以使用完整功能' }
    },

    // 需求分析任务 Mock（浏览器模式使用 localStorage）
    analysisGetTasks: async () => {
      try {
        const raw = localStorage.getItem('pt_analysis_tasks')
        return { success: true, data: raw ? JSON.parse(raw) : [] }
      } catch {
        return { success: true, data: [] }
      }
    },

    analysisGetTask: async (id: string) => {
      try {
        const raw = localStorage.getItem('pt_analysis_tasks')
        const tasks = raw ? JSON.parse(raw) : []
        return { success: true, data: tasks.find((t: { id: string }) => t.id === id) }
      } catch {
        return { success: true, data: undefined }
      }
    },

    analysisSaveTask: async (task) => {
      try {
        const raw = localStorage.getItem('pt_analysis_tasks')
        const tasks = raw ? JSON.parse(raw) : []
        const idx = tasks.findIndex((t: { id: string }) => t.id === task.id)
        if (idx !== -1) {
          tasks[idx] = task
        } else {
          tasks.unshift(task)
        }
        localStorage.setItem('pt_analysis_tasks', JSON.stringify(tasks.slice(0, 50)))
        return { success: true, data: task }
      } catch {
        return { success: false, error: '保存失败' }
      }
    },

    analysisDeleteTask: async (id: string) => {
      try {
        const raw = localStorage.getItem('pt_analysis_tasks')
        const tasks = raw ? JSON.parse(raw) : []
        const filtered = tasks.filter((t: { id: string }) => t.id !== id)
        localStorage.setItem('pt_analysis_tasks', JSON.stringify(filtered))
        return { success: true, data: true }
      } catch {
        return { success: false, error: '删除失败' }
      }
    },

    analysisGetLogs: async () => {
      return { success: true, data: [] }
    },

    analysisStart: async () => {
      console.warn('[Mock] analysisStart: 浏览器模式不支持后台任务执行')
      return { success: false, error: '请在 Electron 桌面端运行以使用完整功能' }
    },

    analysisCancel: async () => {
      console.warn('[Mock] analysisCancel: 浏览器模式不支持任务取消')
      return { success: false, error: '请在 Electron 桌面端运行以使用完整功能' }
    },

    // 市场洞察报告 Mock（浏览器模式使用 localStorage）
    marketGetReports: async () => {
      try {
        const raw = localStorage.getItem('pt_market_reports')
        return { success: true, data: raw ? JSON.parse(raw) : [] }
      } catch {
        return { success: true, data: [] }
      }
    },

    marketGetReport: async (id: string) => {
      try {
        const raw = localStorage.getItem('pt_market_reports')
        const reports = raw ? JSON.parse(raw) : []
        return { success: true, data: reports.find((r: { id: string }) => r.id === id) }
      } catch {
        return { success: true, data: undefined }
      }
    },

    marketSaveReport: async (report) => {
      try {
        const raw = localStorage.getItem('pt_market_reports')
        const reports = raw ? JSON.parse(raw) : []
        const idx = reports.findIndex((r: { id: string }) => r.id === report.id)
        if (idx !== -1) {
          reports[idx] = report
        } else {
          reports.unshift(report)
        }
        localStorage.setItem('pt_market_reports', JSON.stringify(reports.slice(0, 50)))
        return { success: true, data: report }
      } catch {
        return { success: false, error: '保存失败' }
      }
    },

    marketDeleteReport: async (id: string) => {
      try {
        const raw = localStorage.getItem('pt_market_reports')
        const reports = raw ? JSON.parse(raw) : []
        const filtered = reports.filter((r: { id: string }) => r.id !== id)
        localStorage.setItem('pt_market_reports', JSON.stringify(filtered))
        return { success: true, data: true }
      } catch {
        return { success: false, error: '删除失败' }
      }
    },

    marketGetLogs: async () => {
      return { success: true, data: [] }
    },

    marketStart: async () => {
      console.warn('[Mock] marketStart: 浏览器模式不支持后台任务执行')
      return { success: false, error: '请在 Electron 桌面端运行以使用完整功能' }
    },

    marketCancel: async () => {
      console.warn('[Mock] marketCancel: 浏览器模式不支持任务取消')
      return { success: false, error: '请在 Electron 桌面端运行以使用完整功能' }
    },

    // 设计文档 Mock（浏览器模式使用 localStorage）
    designGetDocs: async () => {
      try {
        const raw = localStorage.getItem('pt_design_docs')
        return { success: true, data: raw ? JSON.parse(raw) : [] }
      } catch {
        return { success: true, data: [] }
      }
    },

    designGetDoc: async (id: string) => {
      try {
        const raw = localStorage.getItem('pt_design_docs')
        const docs = raw ? JSON.parse(raw) : []
        return { success: true, data: docs.find((d: { id: string }) => d.id === id) }
      } catch {
        return { success: true, data: undefined }
      }
    },

    designSaveDoc: async (doc) => {
      try {
        const raw = localStorage.getItem('pt_design_docs')
        const docs = raw ? JSON.parse(raw) : []
        const idx = docs.findIndex((d: { id: string }) => d.id === doc.id)
        if (idx !== -1) {
          docs[idx] = doc
        } else {
          docs.unshift(doc)
        }
        localStorage.setItem('pt_design_docs', JSON.stringify(docs.slice(0, 50)))
        return { success: true, data: doc }
      } catch {
        return { success: false, error: '保存失败' }
      }
    },

    designDeleteDoc: async (id: string) => {
      try {
        const raw = localStorage.getItem('pt_design_docs')
        const docs = raw ? JSON.parse(raw) : []
        const filtered = docs.filter((d: { id: string }) => d.id !== id)
        localStorage.setItem('pt_design_docs', JSON.stringify(filtered))
        return { success: true, data: true }
      } catch {
        return { success: false, error: '删除失败' }
      }
    },

    designGetLogs: async () => {
      return { success: true, data: [] }
    },

    designStart: async () => {
      console.warn('[Mock] designStart: 浏览器模式不支持后台任务执行')
      return { success: false, error: '请在 Electron 桌面端运行以使用完整功能' }
    },

    designCancel: async () => {
      console.warn('[Mock] designCancel: 浏览器模式不支持任务取消')
      return { success: false, error: '请在 Electron 桌面端运行以使用完整功能' }
    },

    // 数据清除 Mock（浏览器模式使用 localStorage）
    dataClearMarket: async () => {
      localStorage.removeItem('pt_market_reports')
      return { success: true }
    },

    dataClearAnalysis: async () => {
      localStorage.removeItem('pt_analysis_tasks')
      return { success: true }
    },

    dataClearPrototype: async () => {
      localStorage.removeItem('pt_prototypes')
      return { success: true }
    },

    dataClearDesign: async () => {
      localStorage.removeItem('pt_design_docs')
      return { success: true }
    }
  }

  console.info('[ProductTools] 运行在浏览器预览模式，electronAPI 已 Mock。')
  console.info('[ProductTools] 完整功能请通过 npm run electron:dev 启动桌面端。')
}
