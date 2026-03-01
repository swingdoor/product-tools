<template>
  <div class="market-view-page">
    <!-- 顶部导航栏 -->
    <header class="page-header">
      <div class="header-left">
        <el-button text @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回列表
        </el-button>
        <div class="divider" />
        <h1 class="page-title">{{ report?.title || '市场洞察报告' }}</h1>
        <el-tag v-if="report" :type="getStatusType(report.status)" size="small" effect="light">
          {{ getStatusText(report.status) }}
        </el-tag>
      </div>
      <div class="header-right">
        <el-button-group>
          <el-button :type="isEditing ? 'default' : 'primary'" @click="isEditing = false">
            <el-icon><View /></el-icon>
            预览
          </el-button>
          <el-button :type="isEditing ? 'primary' : 'default'" @click="isEditing = true">
            <el-icon><Edit /></el-icon>
            编辑
          </el-button>
        </el-button-group>
        <el-button @click="handleDownload">
          <el-icon><Download /></el-icon>
          下载
        </el-button>
      </div>
    </header>

    <!-- 任务信息栏 -->
    <div class="task-info-bar" v-if="report">
      <div class="info-item">
        <span class="info-label">行业/领域</span>
        <span class="info-value industry-tag">{{ report.industry }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">目标用户</span>
        <span class="info-value">{{ report.targetUsers }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">创建时间</span>
        <span class="info-value">{{ report.createdAt }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">更新时间</span>
        <span class="info-value">{{ report.updatedAt }}</span>
      </div>
      <div v-if="report.deepSearch" class="info-item">
        <span class="info-label">研究模式</span>
        <el-tag size="small" type="warning" effect="dark" class="res-badge">
          Deep Research 联网检索
        </el-tag>
      </div>
    </div>

    <!-- 内容区 -->
    <main class="page-content" v-loading="loading">
      <!-- 编辑模式：左右分栏 -->
      <div v-if="isEditing" class="edit-mode">
        <div class="editor-container">
          <!-- 左侧编辑器 -->
          <div class="editor-pane">
            <div class="pane-header">
              <span class="pane-title">Markdown 编辑</span>
            </div>
            <el-input
              v-model="editContent"
              type="textarea"
              placeholder="输入 Markdown 内容..."
              class="edit-textarea"
            />
          </div>
          <!-- 右侧实时预览 -->
          <div class="preview-pane">
            <div class="pane-header">
              <span class="pane-title">实时预览</span>
            </div>
            <div class="preview-content markdown-body" v-html="renderedPreview" />
          </div>
        </div>
        <div class="edit-actions">
          <el-button @click="handleCancelEdit">取消</el-button>
          <el-button type="primary" @click="handleSaveEdit" :disabled="!hasChanges">
            保存修改
          </el-button>
        </div>
      </div>

      <!-- 预览模式 -->
      <div v-else class="preview-mode">
        <MarkdownRenderer
          v-if="report?.resultContent"
          :content="report.resultContent"
          :filename="report.title"
          :show-toolbar="true"
          :searchable="true"
          :exportable="true"
          :printable="true"
        />
        <el-empty v-else description="暂无报告内容" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, View, Edit, Download, Search } from '@element-plus/icons-vue'
import { marked } from 'marked'
import { useMarketInsightStore, type MarketReport, type TaskStatus } from '@/stores/marketInsight'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'

// 配置 marked
marked.setOptions({ breaks: true, gfm: true })

const route = useRoute()
const router = useRouter()
const marketStore = useMarketInsightStore()

const loading = ref(false)
const isEditing = ref(false)
const editContent = ref('')
const report = ref<MarketReport | null>(null)

const hasChanges = computed(() => {
  if (!isEditing.value) return false
  return editContent.value !== (report.value?.resultContent || '')
})

// 实时预览渲染
const renderedPreview = computed(() => {
  if (!editContent.value) return '<p style="color:#86909C;text-align:center;padding:40px 0">暂无内容</p>'
  return marked(editContent.value) as string
})

// 状态映射
function getStatusType(status: TaskStatus): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  const map = {
    pending: 'info' as const,
    generating: 'warning' as const,
    completed: 'success' as const,
    failed: 'danger' as const
  }
  return map[status] || 'info'
}

function getStatusText(status: TaskStatus): string {
  const map = { pending: '待执行', generating: '执行中', completed: '已完成', failed: '失败' }
  return map[status] || '未知'
}

// 返回列表
function goBack() {
  if (hasChanges.value) {
    ElMessageBox.confirm('有未保存的修改，是否放弃?', '提示', {
      type: 'warning',
      confirmButtonText: '放弃',
      cancelButtonText: '继续编辑'
    }).then(() => {
      router.push({ name: 'MarketInsight' })
    }).catch(() => {})
  } else {
    router.push({ name: 'MarketInsight' })
  }
}

// 切换到编辑模式时初始化内容
watch(isEditing, (val) => {
  if (val && report.value) {
    editContent.value = report.value.resultContent || ''
  }
})

// 取消编辑
function handleCancelEdit() {
  if (hasChanges.value) {
    ElMessageBox.confirm('有未保存的修改，是否放弃?', '提示', {
      type: 'warning'
    }).then(() => {
      editContent.value = report.value?.resultContent || ''
      isEditing.value = false
    }).catch(() => {})
  } else {
    isEditing.value = false
  }
}

// 保存编辑
async function handleSaveEdit() {
  if (!report.value) return

  loading.value = true
  try {
    report.value.resultContent = editContent.value
    const success = await marketStore.updateReport(report.value)
    if (success) {
      ElMessage.success('保存成功')
      isEditing.value = false
    } else {
      ElMessage.error('保存失败')
    }
  } finally {
    loading.value = false
  }
}

// 下载 MD 文件
async function handleDownload() {
  if (!report.value?.resultContent) {
    ElMessage.warning('暂无内容可下载')
    return
  }

  if (!window.electronAPI) {
    // Web 模式：使用 Blob 下载
    const blob = new Blob([report.value.resultContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.value.title}.md`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('下载完成')
    return
  }

  // Electron 模式
  const result = await window.electronAPI.showSaveDialog({
    title: '下载市场洞察报告',
    defaultPath: report.value.title,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })

  if (result.canceled || !result.filePath) return

  const writeResult = await window.electronAPI.writeFile(result.filePath, report.value.resultContent)
  if (writeResult.success) {
    ElMessage.success('下载成功')
    await window.electronAPI.openFile(result.filePath)
  } else {
    ElMessage.error(`下载失败: ${writeResult.error}`)
  }
}

// 加载报告
async function loadReportData() {
  const reportId = route.params.id as string
  if (!reportId) {
    ElMessage.error('报告ID无效')
    router.push({ name: 'MarketInsight' })
    return
  }

  loading.value = true
  try {
    const loadedReport = await marketStore.loadReport(reportId)
    if (loadedReport) {
      report.value = loadedReport
    } else {
      ElMessage.error('报告不存在')
      router.push({ name: 'MarketInsight' })
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadReportData()
})
</script>

<style scoped>
.market-view-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--bg-white);
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--border);
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-info-bar {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 12px 24px;
  background: #FAFAFA;
  border-bottom: 1px solid var(--border);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-label {
  font-size: 13px;
  color: var(--text-tertiary);
}

.info-value {
  font-size: 13px;
  color: var(--text-primary);
}

.industry-tag {
  font-size: 12px;
  color: #3491FA;
  background: #E8F3FF;
  padding: 2px 8px;
  border-radius: 4px;
}

.res-badge {
  font-weight: bold;
  height: 22px;
  padding: 0 8px;
}

.page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.edit-mode {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 24px;
  gap: 16px;
  overflow: hidden;
}

.editor-container {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;
}

.editor-pane,
.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-white);
}

.pane-header {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: #FAFAFA;
}

.pane-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.editor-pane .edit-textarea {
  flex: 1;
  border: none;
}

.editor-pane .edit-textarea :deep(.el-textarea__inner) {
  height: 100% !important;
  border: none;
  border-radius: 0;
  font-family: 'Consolas', 'Monaco', 'Menlo', monospace;
  font-size: 14px;
  line-height: 1.7;
  padding: 16px;
  resize: none;
}

.preview-pane .preview-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.edit-textarea {
  flex: 1;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.preview-mode {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-mode :deep(.markdown-renderer) {
  flex: 1;
}
</style>
