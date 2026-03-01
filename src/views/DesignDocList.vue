<template>
  <div class="design-doc-list">
    <!-- 顶部工具栏 -->
    <header class="page-header">
      <div class="header-left">
        <span class="task-count">共 {{ designDocStore.tasks.length }} 个文档</span>
      </div>
      <div class="header-right">
        <el-input
          v-model="searchQuery"
          placeholder="搜索文档名称..."
          prefix-icon="Search"
          clearable
          style="width: 220px"
        />
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 120px">
          <el-option label="全部" value="" />
          <el-option label="待提交" value="pending" />
          <el-option label="执行中" value="generating" />
          <el-option label="已完成" value="completed" />
          <el-option label="失败" value="failed" />
        </el-select>
        <div class="header-actions">
          <el-radio-group v-model="viewMode" size="small" class="view-toggle">
            <el-radio-button label="table">
              <el-icon><Menu /></el-icon>
            </el-radio-button>
            <el-radio-button label="card">
              <el-icon><Grid /></el-icon>
            </el-radio-button>
          </el-radio-group>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            新建文档
          </el-button>
        </div>
      </div>
    </header>

    <!-- 列表展示 -->
    <main class="page-content">
      <!-- 表格视图 -->
      <el-table
        v-if="viewMode === 'table'"
        :data="filteredTasks"
        style="width: 100%"
        class="task-table"
        :row-class-name="getRowClassName"
        @row-click="handleRowClick"
        v-loading="designDocStore.loading"
      >
        <el-table-column prop="title" label="文档名称" width="340">
          <template #default="{ row }">
            <div class="task-name">
              <el-icon v-if="row.status === 'generating'" class="rotating" color="#165DFF"><Loading /></el-icon>
              <span>{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="sourceProjectTitle" label="关联项目/原型" min-width="180">
          <template #default="{ row }">
            <span class="source-project-link">{{ row.sourceProjectTitle || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="引用知识" width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.knowledgeRefDocs?.length" class="ref-docs-text">
              {{ getRefDocsNames(row.knowledgeRefDocs) }}
            </span>
            <span v-else class="no-ref-text">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="最近更新" width="180">
          <template #default="{ row }">
            <span class="time-cell">{{ formatDate(row.updatedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                v-if="row.status === 'pending'"
                type="primary"
                size="small"
                @click.stop="handleSubmit(row)"
              >提交生成</el-button>

              <el-button
                v-if="row.status === 'failed' || row.status === 'completed'"
                type="primary"
                size="small"
                plain
                @click.stop="handleSubmit(row)"
              >重新提交</el-button>

              <el-button
                v-if="row.status === 'completed'"
                type="success"
                size="small"
                plain
                @click.stop="goToView(row.id)"
              >查看</el-button>

              <el-button
                v-if="row.status === 'generating'"
                type="warning"
                size="small"
                plain
                @click.stop="handleCancel(row)"
              >取消</el-button>

              <el-popconfirm
                v-if="row.status !== 'generating'"
                title="确定删除此文档？"
                @confirm="handleDelete(row.id)"
              >
                <template #reference>
                  <el-button type="danger" size="small" plain @click.stop>删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无文档，请点击右上角新建">
            <el-button type="primary" @click="showCreateDialog = true">立即新建</el-button>
          </el-empty>
        </template>
      </el-table>

      <!-- 卡片视图 -->
      <div v-else class="task-grid" v-loading="designDocStore.loading">
        <div v-for="row in filteredTasks" :key="row.id" class="task-card" @click="handleRowClick(row)">
          <!-- 第一行：名称和操作 -->
          <div class="card-header">
            <div class="card-title-wrap">
              <el-icon v-if="row.status === 'generating'" class="rotating" color="#165DFF"><Loading /></el-icon>
              <h3 class="card-title" :title="row.title">{{ row.title }}</h3>
            </div>
            <div class="card-actions">
              <el-button
                v-if="row.status === 'pending'"
                type="primary"
                size="small"
                link
                @click.stop="handleSubmit(row)"
              >生成</el-button>
              <el-button
                v-if="row.status === 'failed' || row.status === 'completed'"
                type="primary"
                size="small"
                link
                @click.stop="handleSubmit(row)"
              >重试</el-button>
              <el-button
                v-if="row.status === 'completed'"
                type="success"
                size="small"
                link
                @click.stop="goToView(row.id)"
              >查看</el-button>
              <el-button
                v-if="row.status === 'generating'"
                type="warning"
                size="small"
                link
                @click.stop="handleCancel(row)"
              >取消</el-button>
              <el-popconfirm
                v-if="row.status !== 'generating'"
                title="确定删除？"
                @confirm="handleDelete(row.id)"
              >
                <template #reference>
                  <el-button type="danger" size="small" link @click.stop>删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>

          <!-- 第二行：关联信息和状态 -->
          <div class="card-meta">
            <span class="source-tag" v-if="row.sourceProjectTitle">
              关联：{{ row.sourceProjectTitle }}
            </span>
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ getStatusText(row.status) }}
            </el-tag>
            <span v-if="row.knowledgeRefDocs?.length" class="card-ref-info">
              <el-icon><Document /></el-icon>
              知识: {{ row.knowledgeRefDocs.length }}
            </span>
          </div>

          <!-- 第三行：日期 -->
          <div class="card-footer">
            <div class="card-date">{{ formatDate(row.updatedAt) }}</div>
          </div>
        </div>
        <div v-if="!filteredTasks.length" class="empty-wrapper">
          <el-empty description="暂无文档" />
        </div>
      </div>
    </main>

    <!-- 新建弹窗 -->
    <el-dialog v-model="showCreateDialog" title="新建设计文档" width="600px" :close-on-click-modal="false" class="ant-dialog">
      <el-form :model="createForm" label-position="top" class="compact-form">
        <div class="form-section">
          <div class="section-title">基础配置</div>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="文档标题 (选填)">
                <el-input v-model="createForm.title" placeholder="自动根据项目生成" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="关联项目/原型" required>
                <el-select v-model="createForm.sourceProjectId" placeholder="请选择项目" style="width: 100%">
                  <el-option
                    v-for="p in completedProjects"
                    :key="p.id"
                    :label="p.title"
                    :value="p.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <div class="form-section">
          <div class="section-title">参考配置</div>
          <el-row :gutter="20">
            <el-col :span="24">
              <el-form-item label="引用知识库">
                <el-radio-group v-model="createForm.knowledgeRefMode" size="small" class="compact-radio">
                  <el-radio value="none">不引用</el-radio>
                  <el-radio value="auto">自动检索</el-radio>
                  <el-radio value="manual">手动选择</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item v-if="createForm.knowledgeRefMode === 'manual'" class="compact-item">
            <el-select
              v-model="createForm.knowledgeRefDocs"
              multiple
              filterable
              placeholder="请选择知识库文档..."
              style="width: 100%"
            >
              <el-option
                v-for="doc in availableDocs"
                :key="doc.id"
                :label="doc.filename"
                :value="doc.id"
              />
            </el-select>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showCreateDialog = false">取消</el-button>
          <el-button type="primary" :disabled="!createForm.sourceProjectId" @click="handleCreate">
            创建并开始生成
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElNotification } from 'element-plus'
import { Plus, Loading, Search, Menu, Grid } from '@element-plus/icons-vue'
import { useDesignDocStore, type DesignDoc, type TaskStatus } from '@/stores/designDoc'
import { useProductAnalysisStore } from '@/stores/productAnalysis'
import { useProductPrototypeStore } from '@/stores/productPrototype'
import { useSettingsStore } from '@/stores/settings'
import { knowledgeApi } from '@/api/knowledgeApi'

const router = useRouter()
const designDocStore = useDesignDocStore()
const analysisStore = useProductAnalysisStore()
const prototypeStore = useProductPrototypeStore()
const settingsStore = useSettingsStore()

// 视图模式
const viewMode = ref(localStorage.getItem('designDocViewMode') || 'table')
watch(viewMode, (val) => {
  localStorage.setItem('designDocViewMode', val)
})

// 搜索和筛选
const searchQuery = ref('')
const statusFilter = ref('')

// 创建表单
const showCreateDialog = ref(false)
const createForm = ref({
  sourceProjectId: '',
  title: '',
  knowledgeRefMode: 'none' as 'none' | 'auto' | 'manual',
  knowledgeRefDocs: [] as string[]
})

// 知识库文档
const availableDocs = ref<any[]>([])

// 轮询
let pollInterval: ReturnType<typeof setInterval> | null = null
const POLL_MS = 3000

// 数据过滤
const filteredTasks = computed(() => {
  return designDocStore.tasks.filter(doc => {
    const matchQuery = !searchQuery.value || doc.title.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchStatus = !statusFilter.value || doc.status === statusFilter.value
    return matchQuery && matchStatus
  })
})

// 获取已完成的项目/原型作为数据源
const completedProjects = computed(() => {
  const fromAnalysis = analysisStore.tasks
    .filter(t => t.status === 'completed')
    .map(t => ({ id: t.id, title: `[分析] ${t.title}` }))
  
  const fromPrototype = prototypeStore.tasks
    .filter(t => t.status === 'completed')
    .map(t => ({ id: t.id, title: `[原型] ${t.title}` }))
    
  return [...fromAnalysis, ...fromPrototype]
})

// 状态样式
function getStatusType(status: TaskStatus): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  const map = {
    pending: 'info' as const,
    generating: 'warning' as const,
    completed: 'success' as const,
    failed: 'danger' as const
  }
  return map[status] || 'info'
}

// 格式化日期
function formatDate(dateStr: string) {
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

function getStatusText(status: TaskStatus): string {
  const map = {
    pending: '待提交',
    generating: '执行中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status] || '未知'
}

// 获取引用文档名称列表
function getRefDocsNames(docIds?: string[]): string {
  if (!docIds || docIds.length === 0) return '-'
  return docIds
    .map(id => availableDocs.value.find(d => d.id === id)?.filename)
    .filter(name => !!name)
    .join(', ')
}

function getRowClassName({ row }: { row: DesignDoc }): string {
  return row.status === 'generating' ? 'generating-row' : ''
}

// 行为处理
async function handleCreate() {
  if (!settingsStore.isConfigured) {
    ElNotification.warning({ title: '配置提示', message: '请先在"设置"中配置AI参数', duration: 3000 })
    return
  }

  const sourceId = createForm.value.sourceProjectId
  const source = completedProjects.value.find(p => p.id === sourceId)
  
  const doc = await designDocStore.createTask({
    title: createForm.value.title || `${source?.title} 设计文档`,
    sourceProjectId: sourceId,
    sourceProjectTitle: source?.title || '',
    knowledgeRefMode: createForm.value.knowledgeRefMode,
    knowledgeRefDocs: [...createForm.value.knowledgeRefDocs]
  })

  if (doc?.task) {
    showCreateDialog.value = false
    // 立即启动
    const settings = settingsStore.settings
    await designDocStore.startTask(
      doc.task.id
    )
    startPolling()
    ElMessage.success('文档已创建，开始生成中...')
    createForm.value = { sourceProjectId: '', title: '', knowledgeRefMode: 'none', knowledgeRefDocs: [] }
  }
}

async function handleSubmit(doc: DesignDoc) {
  if (!settingsStore.isConfigured) {
    ElNotification.warning({ title: '配置提示', message: '请先在"设置"中配置AI参数', duration: 3000 })
    return
  }

  const settings = settingsStore.settings
  const result = await designDocStore.startTask(
    doc.id
  )
  if (result.success) {
    ElMessage.success('已提交生成任务')
    startPolling()
  } else {
    ElMessage.error(result.error || '提交失败')
  }
}

async function handleCancel(doc: DesignDoc) {
  await designDocStore.cancelTask(doc.id)
  ElMessage.info('已取消生成任务')
}

async function handleDelete(id: string) {
  const success = await designDocStore.deleteTask(id)
  if (success) ElMessage.success('删除完成')
}

function goToView(id: string) {
  router.push({ name: 'DesignDocView', params: { id } })
}

function handleRowClick(row: DesignDoc) {
  if (row.status === 'completed') {
    goToView(row.id)
  }
}

// 轮询逻辑
function startPolling() {
  if (pollInterval) return
  pollInterval = setInterval(async () => {
    const hasGenerating = designDocStore.tasks.some(t => t.status === 'generating')
    if (hasGenerating) {
      await designDocStore.loadTasks()
    } else {
      stopPolling()
    }
  }, POLL_MS)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

// 生命周期
onMounted(async () => {
  await Promise.all([
    designDocStore.loadTasks(),
    analysisStore.loadTasks(),
    prototypeStore.loadTasks()
  ])
  
  if (designDocStore.tasks.some(t => t.status === 'generating')) {
    startPolling()
  }
  knowledgeApi.getList().then(res => {
    if (res.success && res.data) {
      availableDocs.value = res.data
    }
  }).catch(e => console.error(e))
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.design-doc-list {
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
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
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

.page-content {
  flex: 1;
  padding: 20px 24px;
  overflow: auto;
}

/* 移除表格圆角 */
.task-table {
  border-radius: 0 !important;
}

.task-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  width: 100%;
  overflow: hidden;
}

.task-name span {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.source-project-link {
  font-size: 13px;
  color: var(--text-secondary);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

.time-cell {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.status-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-text {
  font-size: 12px;
  color: var(--el-color-warning);
  font-weight: 500;
}

:deep(.generating-row) {
  background: #FFFBE6 !important;
}

.rotating {
  animation: rotating 1s linear infinite;
}

.table-actions {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
}

/* 卡片视图样式 */
.task-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.empty-wrapper {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
}

.task-card {
  background: var(--bg-white);
  border: 1px solid var(--border-split);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.task-card:hover {
  border-color: #B4D0FF;
  box-shadow: 0 4px 12px rgba(22, 93, 255, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.card-title-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.source-tag {
  font-size: 12px;
  color: var(--primary);
  background: #E8F3FF;
  padding: 2px 8px;
  border-radius: 4px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-footer {
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px dashed var(--border-split);
  display: flex;
  justify-content: flex-end;
}

.card-date {
  font-size: 12px;
  color: var(--text-tertiary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.view-toggle :deep(.el-radio-button__inner) {
  padding: 8px 12px;
}

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.project-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.project-option .page-count {
  color: var(--text-tertiary);
  font-size: 12px;
}

.no-project-tip {
  margin-top: 8px;
}
/* 弹窗内容样式 */
.create-form {
  padding-right: 8px;
  overflow-x: hidden;
}

.form-section {
  background: #fcfcfc;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--border-light);
}

.form-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
  line-height: 1.4;
}

:deep(.el-dialog__body) {
  padding-top: 10px;
  padding-bottom: 10px;
}

:deep(.el-form-item) {
  margin-bottom: 20px;
}
:deep(.el-form-item:last-child) {
  margin-bottom: 0;
}
:deep(.el-form-item__label) {
  font-weight: 500;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* 弹窗紧凑样式 */
.ant-dialog :deep(.el-dialog__body) {
  padding: 12px 24px;
}

.compact-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.compact-form :deep(.el-form-item__label) {
  padding-bottom: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}

.form-section {
  background: #ffffff;
  border: 1px solid var(--border-split);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid var(--primary);
  line-height: 1;
}

.compact-item {
  margin-top: -4px;
}

.form-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.compact-radio :deep(.el-radio) {
  margin-right: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 8px 0;
}
</style>
