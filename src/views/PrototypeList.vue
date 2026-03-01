<template>
  <div class="prototype-list-page">
    <!-- 顶部标题栏 -->
    <header class="page-header">
      <div class="header-left">
        <span class="task-count">共 {{ prototypeStore.tasks.length }} 个任务</span>
      </div>
      <div class="header-right">
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
            新建任务
          </el-button>
        </div>
      </div>
    </header>

    <!-- 任务列表表格 -->
    <main class="task-list-container">
      <div v-if="!prototypeStore.tasks.length" class="empty-wrapper">
        <el-empty description="暂无原型任务，点击「新建任务」开始创建">
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            新建任务
          </el-button>
        </el-empty>
      </div>

      <!-- 表格视图 -->
      <el-table
        v-if="viewMode === 'table' && prototypeStore.tasks.length"
        :data="prototypeStore.tasks"
        style="width: 100%"
        row-key="id"
        class="task-table"
        @row-click="handleRowClick"
      >
        <el-table-column prop="title" label="任务名称" width="340">
          <template #default="{ row }">
            <div class="task-name">
              <span>{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="analysisContent" label="需求描述" min-width="260">
          <template #default="{ row }">
            <el-tooltip :content="row.analysisContent" placement="top" :show-after="500">
              <span class="task-desc">{{ truncateText(row.analysisContent, 50) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="任务状态" width="110" align="center">
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

        <el-table-column prop="updatedAt" label="更新时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <!-- 未提交/失败 → 提交生成 -->
              <el-button
                v-if="row.status === 'pending'"
                type="primary"
                size="small"
                @click.stop="goToGenerate(row.id, 'generate')"
              >
                提交生成
              </el-button>

              <!-- 已完成/失败 → 重新提交 -->
              <el-button
                v-if="row.status === 'completed' || row.status === 'failed'"
                type="primary"
                size="small"
                plain
                @click.stop="goToGenerate(row.id, 'generate')"
              >
                重新提交
              </el-button>

              <!-- 已完成 → 进入查看页 -->
              <el-button
                v-if="row.status === 'completed'"
                type="success"
                size="small"
                plain
                @click.stop="goToView(row.id)"
              >
                查看
              </el-button>

              <!-- 生成中 → 进入生成页 -->
              <el-button
                v-if="row.status === 'generating'"
                type="warning"
                size="small"
                plain
                @click.stop="goToGenerate(row.id)"
              >
                查看生成
              </el-button>

              <!-- 取消按钮 -->
              <el-button
                v-if="row.status === 'generating'"
                type="warning"
                size="small"
                plain
                @click.stop="handleCancel(row)"
              >取消</el-button>

              <!-- 删除按钮 -->
              <el-popconfirm
                v-if="row.status !== 'generating'"
                title="确定删除此任务？"
                confirm-button-text="删除"
                cancel-button-text="取消"
                @confirm="deleteTask(row)"
              >
                <template #reference>
                  <el-button type="danger" size="small" plain @click.stop>删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 卡片视图 -->
      <div v-else-if="viewMode === 'card' && prototypeStore.tasks.length" class="task-grid">
        <div v-for="row in prototypeStore.tasks" :key="row.id" class="task-card" @click="handleRowClick(row)">
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
                @click.stop="goToGenerate(row.id, 'generate')"
              >生成</el-button>
              <el-button
                v-if="row.status === 'completed' || row.status === 'failed'"
                type="primary"
                size="small"
                link
                @click.stop="goToGenerate(row.id, 'generate')"
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
                @confirm="deleteTask(row)"
              >
                <template #reference>
                  <el-button type="danger" size="small" link @click.stop>删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>

          <!-- 第二行：关联信息和状态 -->
          <div class="card-meta">
            <el-tag size="small" type="primary" plain>{{ getClientTypeLabel(row.clientType) }}</el-tag>
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ getStatusText(row.status) }}
            </el-tag>
            <span v-if="row.knowledgeRefDocs?.length" class="card-ref-info">
              <el-icon><Document /></el-icon>
              知识: {{ row.knowledgeRefDocs.length }}
            </span>
          </div>

          <!-- 第三行：需求描述和日期 -->
          <div class="card-footer">
            <div class="card-desc" v-if="row.analysisContent">
              {{ row.analysisContent.substring(0, 80) }}...
            </div>
            <div class="card-date">{{ formatDate(row.updatedAt) }}</div>
          </div>
        </div>
      </div>
    </main>

    <!-- 新建任务弹窗 -->
    <el-dialog v-model="showCreateDialog" title="新建原型任务" width="680px" :close-on-click-modal="false" class="ant-dialog">
      <el-form :model="createForm" label-position="top" class="compact-form">
        <div class="form-section">
          <div class="section-title">基础配置</div>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="任务名称" required>
                <el-input v-model="createForm.title" placeholder="如：电商APP原型" maxlength="50" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="客户端类型" required>
                <el-select v-model="createForm.clientType" style="width: 100%">
                  <el-option label="Web (PC端)" value="Web" />
                  <el-option label="App (移动端)" value="App" />
                  <el-option label="小程序" value="MiniProgram" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <div class="form-section">
          <div class="section-title">需求与参考</div>
          <el-form-item label="产品需求分析 (可选)">
            <el-select
              v-model="createForm.sourceAnalysisId"
              placeholder="选择已有的需求分析"
              style="width: 100%"
              clearable
              @change="onSelectAnalysis"
            >
              <el-option
                v-for="task in analysisStore.tasks.filter(t => t.status === 'completed' && t.resultContent)"
                :key="task.id"
                :value="task.id"
                :label="task.title"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="任务需求描述" required>
            <el-input
              v-model="createForm.analysisContent"
              type="textarea"
              :rows="3"
              placeholder="描述功能模块、页面结构、交互逻辑等..."
              resize="none"
            />
          </el-form-item>

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
          <el-button :disabled="!canCreate" @click="handleCreateOnly">创建</el-button>
          <el-button type="primary" :disabled="!canCreate" @click="handleCreateAndGenerate">
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
import { Plus, Loading, Menu, Grid } from '@element-plus/icons-vue'
import { useProductPrototypeStore, type PrototypeProject, type TaskStatus } from '@/stores/productPrototype'
import { useProductAnalysisStore } from '@/stores/productAnalysis'
import { useSettingsStore } from '@/stores/settings'
import { knowledgeApi } from '@/api/knowledgeApi'
import { ClientTypes, type ClientTypeKey } from '@/constants/clientTypes'

const router = useRouter()
const prototypeStore = useProductPrototypeStore()
const analysisStore = useProductAnalysisStore()
const settingsStore = useSettingsStore()

// 视图模式
const viewMode = ref(localStorage.getItem('prototypeViewMode') || 'table')
watch(viewMode, (val) => {
  localStorage.setItem('prototypeViewMode', val)
})

// 轮询定时器
let pollTimer: ReturnType<typeof setInterval> | null = null
const POLL_INTERVAL = 3000

// 轮询
function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    if (prototypeStore.generatingCount > 0) {
      await prototypeStore.loadTasks()
    }
  }, POLL_INTERVAL)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// 初始化时从数据库加载项目
onMounted(async () => {
  await prototypeStore.loadTasks()
  await analysisStore.loadTasks() // 加载分析任务以供选择
  if (prototypeStore.generatingCount > 0) {
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

// 新建弹窗
const showCreateDialog = ref(false)
const createForm = ref({
  title: '',
  clientType: 'Web端',
  sourceAnalysisId: '',
  analysisContent: '',
  knowledgeRefMode: 'none' as 'none' | 'auto' | 'manual',
  knowledgeRefDocs: [] as string[]
})

// 知识库文档
const availableDocs = ref<any[]>([])

const canCreate = computed(() =>
  createForm.value.title.trim().length > 0 &&
  createForm.value.clientType &&
  createForm.value.analysisContent.trim().length > 0
)

// 状态映射
function getStatusType(status: TaskStatus): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  const map: Record<TaskStatus, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
    pending: 'info',
    generating: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return map[status]
}

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
  const map: Record<TaskStatus, string> = {
    pending: '待提交',
    generating: '执行中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status]
}

function getClientTypeLabel(type: string): string {
  const key = type as ClientTypeKey;
  if (ClientTypes[key]) {
    return ClientTypes[key].label;
  }
  return type || 'Web端';
}

function truncateText(text: string, maxLen: number): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

// 获取引用文档名称列表
function getRefDocsNames(docIds?: string[]): string {
  if (!docIds || docIds.length === 0) return '-'
  return docIds
    .map(id => availableDocs.value.find(d => d.id === id)?.filename)
    .filter(name => !!name)
    .join(', ')
}

// 选择需求分析
function onSelectAnalysis(id: string) {
  if (!id) return
  const task = analysisStore.tasks.find(t => t.id === id)
  if (task) {
    createForm.value.analysisContent = task.resultContent || ''
    if (!createForm.value.title) {
      createForm.value.title = task.title + ' 原型'
    }
  }
}

// 重置表单
function resetForm() {
  createForm.value = {
    title: '',
    clientType: 'Web端',
    sourceAnalysisId: '',
    analysisContent: '',
    knowledgeRefMode: 'none',
    knowledgeRefDocs: []
  }
}

// 仅创建任务
async function handleCreateOnly() {
  if (!canCreate.value) return

  await prototypeStore.createTask({
    title: createForm.value.title.trim(),
    clientType: createForm.value.clientType,
    sourceAnalysisId: createForm.value.sourceAnalysisId,
    analysisContent: createForm.value.analysisContent.trim(),
    knowledgeRefMode: createForm.value.knowledgeRefMode,
    knowledgeRefDocs: [...createForm.value.knowledgeRefDocs],
    data: null
  })

  showCreateDialog.value = false
  resetForm()
  ElMessage.success('任务创建成功')
}

// 创建并开始生成
async function handleCreateAndGenerate() {
  if (!canCreate.value) return

  const project = await prototypeStore.createTask({
    title: createForm.value.title.trim(),
    clientType: createForm.value.clientType,
    sourceAnalysisId: createForm.value.sourceAnalysisId,
    analysisContent: createForm.value.analysisContent.trim(),
    knowledgeRefMode: createForm.value.knowledgeRefMode,
    knowledgeRefDocs: [...createForm.value.knowledgeRefDocs],
    data: null
  })

  if (project) {
    showCreateDialog.value = false
    resetForm()
    ElMessage.success('任务创建成功，开始生成...')
    
    // 重置后跳转到生成页
    router.push({ name: 'PrototypeGenerate', params: { id: project.id }, query: { action: 'generate' } })
  }
}

// 取消任务
async function handleCancel(task: PrototypeProject) {
  await prototypeStore.cancelTask(task.id)
  ElMessage.info('已取消生成')
}

// 删除任务
async function deleteTask(project: PrototypeProject) {
  if (project.status === 'generating') {
    window.electronAPI?.removeAiListeners?.()
  }
  await prototypeStore.deleteTask(project.id)
  ElMessage.success('已删除')
}

// 行点击
function handleRowClick(row: PrototypeProject) {
  if (row.status === 'completed') {
    goToView(row.id)
  } else if (row.status === 'generating') {
    goToGenerate(row.id)
  }
}

// 带错误捕获的路由跳转
function goToGenerate(id: string, action?: string) {
  const query = action ? { action } : undefined
  router.push({ name: 'PrototypeGenerate', params: { id }, query }).catch(err => {
    ElNotification.error({
      title: '页面跳转失败',
      message: String(err.message || err),
      duration: 0
    })
    console.error('Router push failed:', err)
  })
}

function goToView(id: string) {
  router.push({ name: 'PrototypeView', params: { id } }).catch(err => {
    ElNotification.error({
      title: '页面跳转失败',
      message: String(err.message || err),
      duration: 0
    })
    console.error('Router push failed:', err)
  })
}
</script>

<style scoped>
.prototype-list-page {
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
  align-items: baseline;
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

.task-list-container {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.task-table {
  background: var(--bg-white);
  border-radius: 0 !important;
}

.task-id {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-tertiary);
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

.task-desc {
  font-size: 13px;
  color: var(--text-secondary);
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
  gap: 8px;
}

.card-footer {
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px dashed var(--border-split);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.card-date {
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: right;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.view-toggle :deep(.el-radio-button__inner) {
  padding: 8px 12px;
}

.rotating {
  animation: rotating 1s linear infinite;
}

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.create-form {
  padding: 0 8px;
}

.form-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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

.client-type-group {
  width: 100%;
}
.client-type-group :deep(.el-radio-button__inner) {
  width: 156px;
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
