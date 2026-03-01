<template>
  <div class="knowledge-list-page">
    <!-- 顶部工具栏 -->
    <header class="page-header">
      <div class="header-left">
        <span class="task-count">共 {{ documents.length }} 个文档</span>
      </div>
      <div class="header-right">
        <el-input
          v-model="searchQuery"
          placeholder="搜索..."
          prefix-icon="Search"
          clearable
          style="width: 240px"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="searchType" style="width: 130px">
          <el-option label="名称搜索" value="keyword" />
          <el-option label="标签搜索" value="tag" />
          <el-option label="语义搜索" value="semantic" />
        </el-select>
        <div class="view-toggle">
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button label="card">
              <el-icon><Menu /></el-icon>
            </el-radio-button>
            <el-radio-button label="list">
              <el-icon><Operation /></el-icon>
            </el-radio-button>
          </el-radio-group>
        </div>
        <el-button type="primary" @click="handleSearch" :loading="searching">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-button type="primary" @click="handleUpload" :loading="uploading">
          <el-icon><UploadFilled /></el-icon>
          上传文档
        </el-button>
      </div>
    </header>

    <!-- 语义搜索结果面板 -->
    <div v-if="semanticResults && semanticResults.chunks && semanticResults.chunks.length > 0" class="semantic-results-panel">
      <div class="semantic-results-header">
        <h3>语义搜索结果</h3>
        <el-button size="small" text @click="clearSemanticResults">清除结果</el-button>
      </div>
      <div class="semantic-chunks">
        <div v-for="(chunk, idx) in semanticResults.chunks" :key="idx" class="semantic-chunk-card">
          <div class="chunk-header">
            <el-tag size="small" type="success">相似度 {{ (chunk.score * 100).toFixed(1) }}%</el-tag>
            <span class="chunk-doc-name">{{ getDocNameById(chunk.docId) }}</span>
            <el-button size="small" type="primary" text @click="goToPreview(chunk.docId, chunk.content)">
              预览此文档
            </el-button>
          </div>
          <div class="chunk-content">{{ chunk.content }}</div>
        </div>
      </div>
    </div>

    <!-- 文档列表 -->
    <main class="page-content" v-loading="loading">
      <div v-if="filteredDocuments.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无文档，点击右上角上传">
          <el-button type="primary" @click="handleUpload">上传文档</el-button>
        </el-empty>
      </div>
      <div v-else>
        <!-- 卡片视图 -->
        <div v-if="viewMode === 'card'" class="doc-grid">
          <div v-for="doc in filteredDocuments" :key="doc.id" class="doc-card">
            <div class="doc-icon">
              <el-icon :size="36" :color="getFileColor(doc.type)">
                <component :is="getFileIcon(doc.type)" />
              </el-icon>
            </div>
            <div class="doc-content">
              <!-- 第一行：名称和操作 -->
              <div class="card-row">
                <div class="doc-name" :title="doc.filename">{{ doc.filename }}</div>
                <div class="doc-actions">
                  <el-tooltip content="管理标签" placement="top">
                    <el-button size="small" circle @click="openTagDialog(doc)">
                      <el-icon><CollectionTag /></el-icon>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip content="预览" placement="top">
                    <el-button size="small" circle @click="handlePreview(doc)">
                      <el-icon><View /></el-icon>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip content="下载" placement="top">
                    <el-button size="small" circle @click="handleDownload(doc)">
                      <el-icon><Download /></el-icon>
                    </el-button>
                  </el-tooltip>
                  <el-button size="small" circle type="danger" plain @click="confirmDelete(doc.id)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>

              <!-- 第二行：类型、大小、时间 -->
              <div class="card-row meta-row">
                <div class="meta-left">
                  <el-tag size="small" effect="plain" :type="getFileTagType(doc.type)">{{ doc.type.toUpperCase() }}</el-tag>
                  <span class="doc-size">{{ formatSize(doc.size) }}</span>
                </div>
                <div class="doc-date">{{ formatDate(doc.createdAt) }}</div>
              </div>

              <!-- 第三行：标签 -->
              <div class="doc-tags" v-if="parseTags(doc.tags).length > 0">
                <el-tag
                  v-for="tag in parseTags(doc.tags)"
                  :key="tag"
                  size="small"
                >{{ tag }}</el-tag>
              </div>
            </div>
          </div>
        </div>

        <!-- 列表视图 -->
        <div v-else class="doc-table-wrap">
          <el-table :data="filteredDocuments" style="width: 100%" class="task-table">
            <el-table-column label="文件名" min-width="250">
              <template #default="{ row }">
                <div class="table-doc-name">
                  <el-icon :color="getFileColor(row.type)" style="margin-right: 8px">
                    <component :is="getFileIcon(row.type)" />
                  </el-icon>
                  <span class="name-text" :title="row.filename">{{ row.filename }}</span>
                </div>
              </template>
            </el-table-column>
            
            <el-table-column label="标签" min-width="180">
              <template #default="{ row }">
                <div class="table-tags">
                  <el-tag
                    v-for="tag in parseTags(row.tags)"
                    :key="tag"
                    size="small"
                    style="margin-right: 4px"
                  >{{ tag }}</el-tag>
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="type" label="类型" width="100" align="center">
              <template #default="{ row }">
                <el-tag size="small" effect="plain" :type="getFileTagType(row.type)">
                  {{ row.type.toUpperCase() }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="大小" width="120" align="right">
              <template #default="{ row }">
                <span class="meta-text">{{ formatSize(row.size) }}</span>
              </template>
            </el-table-column>

            <el-table-column label="创建时间" width="180" align="center">
              <template #default="{ row }">
                <span class="meta-text">{{ formatDate(row.createdAt) }}</span>
              </template>
            </el-table-column>

            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" type="primary" link @click="openTagDialog(row)">标签</el-button>
                  <el-button size="small" type="primary" link @click="handlePreview(row)">预览</el-button>
                  <el-button size="small" type="primary" link @click="handleDownload(row)">下载</el-button>
                  <el-button size="small" type="danger" link @click="confirmDelete(row.id)">删除</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </main>

    <!-- 管理标签弹窗 -->
    <el-dialog v-model="showTagDialog" title="管理标签" width="480px" destroy-on-close>
      <div class="tag-dialog-body">
        <!-- 当前文档的标签 -->
        <div class="dialog-section">
          <div class="section-label">当前文档标签</div>
          <div class="tag-container">
            <el-tag
              v-for="tag in tagDialogTags"
              :key="tag"
              closable
              @close="tagDialogTags = tagDialogTags.filter(t => t !== tag)"
              class="manage-tag"
            >{{ tag }}</el-tag>
            <span v-if="tagDialogTags.length === 0" class="no-data-tip">暂无标签</span>
          </div>
        </div>

        <!-- 输入新标签 -->
        <div class="dialog-section">
          <div class="section-label">添加新标签</div>
          <div class="add-tag-row">
            <el-input
              v-model="newTagInput"
              placeholder="输入新标签，回车或点击添加"
              size="default"
              @keyup.enter="addTagFromInput"
            >
              <template #append>
                <el-button @click="addTagFromInput">添加</el-button>
              </template>
            </el-input>
          </div>
        </div>

        <!-- 历史/系统标签 -->
        <div class="dialog-section">
          <div class="section-label">所有历史标签 (点击快速选择，点击垃圾桶全局删除)</div>
          <div class="tag-history-list">
            <div 
              v-for="tag in allSystemTags" 
              :key="tag" 
              class="history-tag-item"
              :class="{ 'is-active': tagDialogTags.includes(tag) }"
            >
              <span class="tag-text" @click="toggleTag(tag)">{{ tag }}</span>
              <el-icon class="delete-icon" @click.stop="confirmGlobalDelete(tag)"><Delete /></el-icon>
            </div>
            <span v-if="allSystemTags.length === 0" class="no-data-tip">暂无历史标签</span>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showTagDialog = false">取消</el-button>
          <el-button type="primary" @click="saveTagsForDoc">保存更改</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 上传进度弹窗 -->
    <el-dialog v-model="showUploadProgress" title="文档处理中..." width="420px" :close-on-click-modal="false" :show-close="false">
      <div class="upload-progress-content">
        <el-icon class="rotating" :size="40" color="#165DFF"><Loading /></el-icon>
        <p class="upload-status-text">{{ uploadStatusText }}</p>
        <p class="upload-hint">正在解析文档并进行向量化处理，请勿关闭...</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElNotification, ElMessageBox } from 'element-plus'
import { Search, UploadFilled, View, Download, Delete, Loading, Document as DocIcon, Notebook, CollectionTag, Menu, Operation } from '@element-plus/icons-vue'
import { knowledgeApi } from '@/api/knowledgeApi'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const settingsStore = useSettingsStore()

// 状态
const loading = ref(false)
const uploading = ref(false)
const searching = ref(false)
const documents = ref<any[]>([])
const searchQuery = ref('')
const searchType = ref<'keyword' | 'semantic' | 'tag'>('keyword')
const viewMode = ref<'card' | 'list'>((localStorage.getItem('knowledgeViewMode') as any) || 'card')

watch(viewMode, (val) => {
  localStorage.setItem('knowledgeViewMode', val)
})

// 上传进度
const showUploadProgress = ref(false)
const uploadStatusText = ref('')

// 语义搜索结果
const semanticResults = ref<{ docs: any[]; chunks: { docId: string; content: string; score: number }[] } | null>(null)

// 标签弹窗
const showTagDialog = ref(false)
const tagDialogDocId = ref('')
const tagDialogTags = ref<string[]>([])
const newTagInput = ref('')

// 过滤文档
const filteredDocuments = computed(() => {
  if (!searchQuery.value || searchType.value === 'semantic') return documents.value
  const q = searchQuery.value.toLowerCase()
  if (searchType.value === 'tag') {
    return documents.value.filter(d => {
      const tags: string[] = parseTags(d.tags)
      return tags.some(t => t.toLowerCase().includes(q))
    })
  }
  // keyword
  return documents.value.filter(d =>
    d.filename.toLowerCase().includes(q) ||
    d.type.toLowerCase().includes(q)
  )
})

// 获取系统中所有不重复的标签
const allSystemTags = computed(() => {
  const tagSet = new Set<string>()
  documents.value.forEach(doc => {
    parseTags(doc.tags).forEach(tag => tagSet.add(tag))
  })
  return Array.from(tagSet).sort()
})

// 加载文档列表
async function loadDocuments() {
  loading.value = true
  try {
    const res = await knowledgeApi.getList()
    if (res.success && res.data) {
      documents.value = res.data
    }
  } catch (e) {
    console.error('加载文档列表失败', e)
  } finally {
    loading.value = false
  }
}

// 上传文档
async function handleUpload() {
  const embeddingConfig = settingsStore.resolvedEmbeddingConfig
  if (!embeddingConfig.apiKey || !embeddingConfig.baseUrl) {
    ElNotification.warning({
      title: '请先配置 Embedding',
      message: '前往"设置"配置 Embedding API，才能进行文档向量化',
      duration: 4000
    })
    return
  }

  const selectRes = await knowledgeApi.selectFile()
  if (!selectRes.success || !selectRes.data) {
    if (selectRes.error !== 'cancelled') {
      ElMessage.error(selectRes.error || '选择文件失败')
    }
    return
  }

  const fileInfo = selectRes.data
  uploading.value = true
  showUploadProgress.value = true
  uploadStatusText.value = '正在提取文本并向量化处理...'

  try {
    const res = await knowledgeApi.upload({
      sourcePath: fileInfo.sourcePath,
      filename: fileInfo.filename,
      type: fileInfo.type,
      size: fileInfo.size,
      embeddingConfig: {
        apiKey: embeddingConfig.apiKey,
        baseUrl: embeddingConfig.baseUrl,
        model: embeddingConfig.model
      }
    })

    if (res.success) {
      ElMessage.success('文档上传完成！')
      await loadDocuments()
    } else {
      ElMessage.error(res.error || '上传失败')
    }
  } catch (err: any) {
    ElMessage.error(`上传出错: ${err.message || String(err)}`)
  } finally {
    uploading.value = false
    showUploadProgress.value = false
  }
}

// 搜索
async function handleSearch() {
  if (!searchQuery.value.trim()) {
    semanticResults.value = null
    return
  }

  if (searchType.value === 'keyword' || searchType.value === 'tag') {
    semanticResults.value = null
    return
  }

  // 语义搜索
  const embeddingConfig = settingsStore.resolvedEmbeddingConfig
  if (!embeddingConfig.apiKey || !embeddingConfig.baseUrl) {
    ElNotification.warning({
      title: '请先配置 Embedding',
      message: '语义搜索需要配置 Embedding API',
      duration: 4000
    })
    return
  }

  searching.value = true
  try {
    const res = await knowledgeApi.searchSemantic({
      query: searchQuery.value,
      type: 'semantic',
      embeddingConfig: {
        apiKey: embeddingConfig.apiKey,
        baseUrl: embeddingConfig.baseUrl,
        model: embeddingConfig.model
      },
      threshold: settingsStore.settings.vectorSearch?.documentSearch?.threshold,
      topK: settingsStore.settings.vectorSearch?.documentSearch?.topK
    })
    if (res.success && res.data) {
      semanticResults.value = res.data
    } else {
      ElMessage.error(res.error || '语义搜索失败')
    }
  } catch (err: any) {
    ElMessage.error(`搜索出错: ${err.message || String(err)}`)
  } finally {
    searching.value = false
  }
}

function clearSemanticResults() {
  semanticResults.value = null
}

function getDocNameById(docId: string): string {
  const doc = documents.value.find(d => d.id === docId)
  return doc?.filename || docId
}

// 预览 - 跳转到独立预览页面
function handlePreview(doc: any) {
  router.push({ name: 'KnowledgePreview', params: { id: doc.id } })
}

// 语义搜索结果中的"预览此文档"
function goToPreview(docId: string, matchContent?: string) {
  router.push({
    name: 'KnowledgePreview',
    params: { id: docId },
    query: matchContent ? { highlight: matchContent.substring(0, 80) } : {}
  })
}

// 下载/打开
function handleDownload(doc: any) {
  if (window.electronAPI && doc.fullPath) {
    window.electronAPI.openFile(doc.fullPath)
  }
}

// 删除 - 使用 ElMessageBox 代替 el-popconfirm
async function confirmDelete(docId: string) {
  try {
    await ElMessageBox.confirm('确定要删除此文档？删除后无法恢复。', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await handleDelete(docId)
  } catch {
    // 用户取消
  }
}

async function handleDelete(docId: string) {
  try {
    const res = await knowledgeApi.delete(docId)
    if (res.success) {
      ElMessage.success('删除成功')
      await loadDocuments()
    } else {
      ElMessage.error(res.error || '删除失败')
    }
  } catch (err: any) {
    ElMessage.error(`删除出错: ${err.message || String(err)}`)
  }
}

// ── 标签功能 ──
function parseTags(tagsStr: string): string[] {
  try { return JSON.parse(tagsStr || '[]') } catch { return [] }
}

function openTagDialog(doc: any) {
  tagDialogDocId.value = doc.id
  tagDialogTags.value = [...parseTags(doc.tags)]
  newTagInput.value = ''
  showTagDialog.value = true
}

function addTagFromInput() {
  const tag = newTagInput.value.trim()
  if (!tag) return
  if (!tagDialogTags.value.includes(tag)) {
    tagDialogTags.value.push(tag)
  }
  newTagInput.value = ''
}

async function saveTagsForDoc() {
  if (!tagDialogDocId.value) return
  try {
    console.log('Updating tags for:', tagDialogDocId.value, tagDialogTags.value)
    const res = await knowledgeApi.updateTags({ 
      docId: tagDialogDocId.value, 
      tags: [...tagDialogTags.value] 
    })
    
    if (res.success) {
      ElMessage.success('标签已更新')
      showTagDialog.value = false
      await loadDocuments()
    } else {
      ElMessage.error(res.error || '更新标签失败')
    }
  } catch (err: any) {
    console.error('Save tags error:', err)
    ElMessage.error('更新标签过程中出错')
  }
}

async function removeTag(doc: any, tag: string) {
  const tags = parseTags(doc.tags).filter(t => t !== tag)
  try {
    const res = await knowledgeApi.updateTags({ docId: doc.id, tags })
    if (res.success) {
      await loadDocuments()
    } else {
      ElMessage.error(res.error || '删除标签失败')
    }
  } catch {
    ElMessage.error('删除标签出错')
  }
}

// 弹窗内的标签切换逻辑
function toggleTag(tag: string) {
  if (tagDialogTags.value.includes(tag)) {
    tagDialogTags.value = tagDialogTags.value.filter(t => t !== tag)
  } else {
    tagDialogTags.value.push(tag)
  }
}

// 全局删除标签确认
async function confirmGlobalDelete(tag: string) {
  try {
    await ElMessageBox.confirm(
      `确定要全局删除标签 "${tag}" 吗？所有已标记该标签的文件都会移除此标签。此操作不可撤销。`,
      '全局删除标签',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await handleGlobalDeleteTag(tag)
  } catch {
    // 取消
  }
}

// 执行全局删除
async function handleGlobalDeleteTag(tag: string) {
  try {
    const res = await (knowledgeApi as any).deleteGlobalTag(tag)
    if (res.success) {
      ElMessage.success('标签已全局删除')
      // 如果当前弹窗中包含此标签，也移除它
      tagDialogTags.value = tagDialogTags.value.filter(t => t !== tag)
      await loadDocuments()
    } else {
      ElMessage.error(res.error || '全局删除失败')
    }
  } catch (err: any) {
    ElMessage.error('全局删除出错')
  }
}

// 辅助函数
function getFileIcon(type: string) {
  switch (type?.toLowerCase()) {
    case 'pdf': return DocIcon
    case 'doc': case 'docx': return Notebook
    case 'md': return DocIcon
    case 'txt': return DocIcon
    default: return DocIcon
  }
}

function getFileColor(type: string) {
  switch (type?.toLowerCase()) {
    case 'pdf': return '#E53935'
    case 'doc': case 'docx': return '#1976D2'
    case 'md': return '#7B1FA2'
    case 'txt': return '#546E7A'
    default: return '#757575'
  }
}

function getFileTagType(type: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  switch (type?.toLowerCase()) {
    case 'pdf': return 'danger'
    case 'doc': case 'docx': return 'primary'
    case 'md': return 'warning'
    case 'txt': return 'info'
    default: return 'info'
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    const ss = String(date.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
  } catch (e) {
    return dateStr
  }
}

onMounted(() => {
  loadDocuments()
})
</script>

<style scoped>
.knowledge-list-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: var(--bg-white);
  border-bottom: 1px solid var(--border-split);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.task-count {
  font-size: 13px;
  color: var(--text-tertiary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.view-toggle {
  margin-right: 4px;
}

/* 语义搜索结果 */
.semantic-results-panel {
  padding: 16px 24px;
  background: #F0F5FF;
  border-bottom: 1px solid #D6E4FF;
}

.semantic-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.semantic-results-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.semantic-chunks {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
}

.semantic-chunk-card {
  background: white;
  border-radius: 8px;
  padding: 12px 16px;
  border: 1px solid #E8E8E8;
}

.chunk-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.chunk-doc-name {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.chunk-content {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 文档列表 */
.page-content {
  flex: 1;
  padding: 20px 24px;
  overflow: auto;
}

.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.doc-table-wrap {
  background: var(--bg-white);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-split);
}

.table-doc-name {
  display: flex;
  align-items: center;
  font-weight: 500;
  width: 100%;
  overflow: hidden;
}

.name-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.table-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.meta-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.table-actions {
  display: flex;
  gap: 12px;
}

.doc-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  background: var(--bg-white);
  border: 1px solid var(--border-split);
  border-radius: 12px;
  transition: all 0.2s ease;
  cursor: default;
}

.doc-card:hover {
  border-color: #B4D0FF;
  box-shadow: 0 4px 12px rgba(22, 93, 255, 0.08);
}

.doc-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F5F7FA;
  border-radius: 10px;
  margin-top: 2px;
}

.doc-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.doc-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.meta-row {
  margin-top: 2px;
}

.meta-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.doc-size {
  font-size: 12px;
  color: var(--text-tertiary);
}

.doc-date {
  font-size: 12px;
  color: var(--text-tertiary);
}

.doc-tags {
  display: flex;
  flex-wrap: nowrap; /* 改为不换行 */
  gap: 4px;
  margin-top: 6px;
  overflow: hidden; /* 配合 ellipsis 如果后续需要 */
}

.doc-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

/* 标签弹窗 */
.tag-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.existing-tags {
  display: flex;
  flex-wrap: wrap;
}

.add-tag-row {
  display: flex;
  gap: 8px;
}

/* 空状态 */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* 上传进度 */
.upload-progress-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
  gap: 12px;
}

.upload-status-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}

.upload-hint {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
}

.rotating {
  animation: rotating 1.2s linear infinite;
}

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.tag-dialog-body {
  padding: 4px 0;
}

.dialog-section {
  margin-bottom: 20px;
}

.dialog-section:last-child {
  margin-bottom: 0;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.tag-container {
  min-height: 40px;
  padding: 8px;
  background: #f9f9f9;
  border-radius: 6px;
  border: 1px dashed #ddd;
}

.manage-tag {
  margin-right: 8px;
  margin-bottom: 8px;
}

.no-data-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  font-style: italic;
}

.add-tag-row {
  display: flex;
  gap: 8px;
}

.tag-history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 160px;
  overflow-y: auto;
  padding: 4px;
}

.history-tag-item {
  display: flex;
  align-items: center;
  background: #fff;
  border: 1px solid var(--border-split);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.history-tag-item:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.history-tag-item.is-active {
  background: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary);
}

.tag-text {
  flex: 1;
  margin-right: 6px;
}

.delete-icon {
  font-size: 14px;
  color: var(--text-tertiary);
  padding: 2px;
  border-radius: 2px;
  transition: all 0.2s;
}

.delete-icon:hover {
  background: #ff4d4f;
  color: #fff;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
