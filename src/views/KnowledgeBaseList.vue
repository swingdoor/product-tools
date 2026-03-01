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
      <div v-else class="doc-grid">
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
                <el-tooltip content="添加标签" placement="top">
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

            <!-- 第三行：标签（如果有） -->
            <div class="doc-tags" v-if="parseTags(doc.tags).length > 0">
              <el-tag
                v-for="tag in parseTags(doc.tags)"
                :key="tag"
                size="small"
                closable
                @close="removeTag(doc, tag)"
              >{{ tag }}</el-tag>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 添加标签弹窗 -->
    <el-dialog v-model="showTagDialog" title="管理标签" width="440px">
      <div class="tag-dialog-body">
        <div class="existing-tags" v-if="tagDialogTags.length > 0">
          <el-tag
            v-for="tag in tagDialogTags"
            :key="tag"
            closable
            @close="tagDialogTags = tagDialogTags.filter(t => t !== tag)"
            style="margin: 0 6px 6px 0"
          >{{ tag }}</el-tag>
        </div>
        <div class="add-tag-row">
          <el-input
            v-model="newTagInput"
            placeholder="输入标签名称，回车添加"
            size="small"
            @keyup.enter="addTagFromInput"
          />
          <el-button size="small" type="primary" @click="addTagFromInput">添加</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="showTagDialog = false">取消</el-button>
        <el-button type="primary" @click="saveTagsForDoc">保存</el-button>
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElNotification, ElMessageBox } from 'element-plus'
import { Search, UploadFilled, View, Download, Delete, Loading, Document as DocIcon, Notebook, CollectionTag } from '@element-plus/icons-vue'
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
      }
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
  try {
    await knowledgeApi.updateTags({ docId: tagDialogDocId.value, tags: tagDialogTags.value })
    ElMessage.success('标签已更新')
    showTagDialog.value = false
    await loadDocuments()
  } catch (err: any) {
    ElMessage.error('更新标签失败')
  }
}

async function removeTag(doc: any, tag: string) {
  const tags = parseTags(doc.tags).filter(t => t !== tag)
  try {
    await knowledgeApi.updateTags({ docId: doc.id, tags })
    await loadDocuments()
  } catch {
    ElMessage.error('删除标签失败')
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
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
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
  gap: 10px;
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
  grid-template-columns: repeat(3, minmax(0, 1fr)); /* 关键修复：确保列可以收缩，防止溢出 */
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
</style>
