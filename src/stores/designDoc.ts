import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DesignDoc, TaskLog, TaskStatus, PrototypeProject } from '@/electron.d'

export type { DesignDoc, TaskLog, TaskStatus }

export const useDesignDocStore = defineStore('designDoc', () => {
  // 文档列表
  const docs = ref<DesignDoc[]>([])
  // 当前文档
  const currentDoc = ref<DesignDoc | null>(null)
  // 当前文档日志
  const docLogs = ref<TaskLog[]>([])
  // 加载状态
  const loading = ref(false)

  // ────────────────────────────────────────────────────────────
  // 数据库操作方法
  // ────────────────────────────────────────────────────────────

  /** 加载所有文档 */
  async function loadDocs() {
    loading.value = true
    try {
      const result = await window.electronAPI.designGetDocs()
      if (result.success && result.data) {
        docs.value = result.data
      }
    } finally {
      loading.value = false
    }
  }

  /** 加载单个文档 */
  async function loadDoc(id: string) {
    const result = await window.electronAPI.designGetDoc(id)
    if (result.success && result.data) {
      currentDoc.value = result.data
      // 同步更新 docs 列表中的对应文档
      const idx = docs.value.findIndex(d => d.id === id)
      if (idx !== -1) {
        docs.value[idx] = result.data
      }
      // 同时加载日志
      await loadDocLogs(id)
    }
    return result.data
  }

  /** 加载文档日志 */
  async function loadDocLogs(docId: string) {
    const result = await window.electronAPI.designGetLogs(docId)
    if (result.success && result.data) {
      docLogs.value = result.data
    }
  }

  /** 创建文档 */
  async function createDoc(data: {
    title: string
    sourceProject: PrototypeProject
  }): Promise<{ doc: DesignDoc | null; error?: string }> {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const pageCount = data.sourceProject.data?.pages?.length || 0
    
    // 创建纯 JavaScript 对象，避免 Vue reactive 对象无法通过 IPC 克隆
    const newDoc: DesignDoc = {
      id: `design_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: data.title,
      status: 'pending',
      sourceProjectId: data.sourceProject.id,
      sourceProjectTitle: data.sourceProject.title,
      pageCount: pageCount,
      createdAt: now,
      updatedAt: now
    }

    try {
      console.log('[DesignDocStore] 保存文档:', newDoc)
      const result = await window.electronAPI.designSaveDoc(newDoc)
      console.log('[DesignDocStore] 保存结果:', result)
      if (result.success && result.data) {
        docs.value.unshift(result.data)
        return { doc: result.data }
      }
      return { doc: null, error: result.error || '保存文档失败' }
    } catch (err) {
      console.error('[DesignDocStore] 保存异常:', err)
      return { doc: null, error: String(err) }
    }
  }

  /** 更新文档 */
  async function updateDoc(doc: DesignDoc): Promise<boolean> {
    // 创建纯 JavaScript 对象副本，避免 IPC 克隆错误
    const plainDoc: DesignDoc = {
      id: doc.id,
      title: doc.title,
      status: doc.status,
      sourceProjectId: doc.sourceProjectId,
      sourceProjectTitle: doc.sourceProjectTitle,
      pageCount: doc.pageCount,
      resultContent: doc.resultContent,
      createdAt: doc.createdAt,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      errorMessage: doc.errorMessage,
      progress: doc.progress ? { ...doc.progress } : undefined
    }
    
    const result = await window.electronAPI.designSaveDoc(plainDoc)
    if (result.success && result.data) {
      const idx = docs.value.findIndex(d => d.id === doc.id)
      if (idx !== -1) {
        docs.value[idx] = result.data
      }
      if (currentDoc.value?.id === doc.id) {
        currentDoc.value = result.data
      }
      return true
    }
    return false
  }

  /** 删除文档 */
  async function deleteDoc(id: string): Promise<boolean> {
    const result = await window.electronAPI.designDeleteDoc(id)
    if (result.success) {
      docs.value = docs.value.filter(d => d.id !== id)
      if (currentDoc.value?.id === id) {
        currentDoc.value = null
      }
      return true
    }
    return false
  }

  /** 启动文档生成任务 */
  async function startGenerate(
    docId: string,
    apiKey: string,
    baseUrl: string,
    model?: string
  ): Promise<{ success: boolean; error?: string }> {
    const result = await window.electronAPI.designStart(docId, apiKey, baseUrl, model)
    if (result.success) {
      // 刷新文档状态
      await loadDoc(docId)
    }
    return result
  }

  /** 取消文档生成任务 */
  async function cancelGenerate(docId: string): Promise<boolean> {
    const result = await window.electronAPI.designCancel(docId)
    if (result.success) {
      await loadDoc(docId)
      return true
    }
    return false
  }

  /** 通过ID获取文档 */
  function getDocById(id: string): DesignDoc | null {
    return docs.value.find(d => d.id === id) || null
  }

  // ────────────────────────────────────────────────────────────
  // 计算属性
  // ────────────────────────────────────────────────────────────

  /** 生成中的文档数 */
  const generatingCount = computed(() => 
    docs.value.filter(d => d.status === 'generating').length
  )

  /** 已完成的文档数 */
  const completedCount = computed(() => 
    docs.value.filter(d => d.status === 'completed').length
  )

  return {
    docs,
    currentDoc,
    docLogs,
    loading,
    loadDocs,
    loadDoc,
    loadDocLogs,
    createDoc,
    updateDoc,
    deleteDoc,
    startGenerate,
    cancelGenerate,
    getDocById,
    generatingCount,
    completedCount
  }
})
