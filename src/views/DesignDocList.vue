<template>
  <div class="design-doc-list">
    <!-- 顶部工具栏 -->
    <header class="page-header">
      <div class="header-left">
        <h1 class="page-title">设计文档</h1>
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
        <el-button type="primary" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          新建文档
        </el-button>
      </div>
    </header>

    <!-- 列表展示 -->
    <main class="page-content">
      <el-table
        :data="filteredTasks"
        style="width: 100%"
        class="task-table"
        :row-class-name="getRowClassName"
        @row-click="handleRowClick"
        v-loading="designDocStore.loading"
      >
        <el-table-column prop="title" label="文档名称" min-width="200">
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
    </main>

    <!-- 新建弹窗 -->
    <el-dialog v-model="showCreateDialog" title="新建设计文档" width="500px">
      <el-form :model="createForm" label-position="top">
        <el-form-item label="关联项目/原型" required>
          <el-select v-model="createForm.sourceProjectId" placeholder="请选择已完成的项目或原型" style="width: 100%">
            <el-option
              v-for="p in completedProjects"
              :key="p.id"
              :label="p.title"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="文档标题 (选填)">
          <el-input v-model="createForm.title" placeholder="留空则自动根据项目生成" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!createForm.sourceProjectId" @click="handleCreate">
          创建并开始生成
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElNotification } from 'element-plus'
import { Plus, Loading } from '@element-plus/icons-vue'
import { useDesignDocStore, type DesignDoc, type TaskStatus } from '@/stores/designDoc'
import { useProductAnalysisStore } from '@/stores/productAnalysis'
import { useProductPrototypeStore } from '@/stores/productPrototype'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const designDocStore = useDesignDocStore()
const analysisStore = useProductAnalysisStore()
const prototypeStore = useProductPrototypeStore()
const settingsStore = useSettingsStore()

// 搜索和筛选
const searchQuery = ref('')
const statusFilter = ref('')

// 创建表单
const showCreateDialog = ref(false)
const createForm = ref({
  sourceProjectId: '',
  title: ''
})

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
  // 处理 ISO 格式或其他带 T/Z 的格式
  return dateStr.replace('T', ' ').split('.')[0].replace('Z', '')
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
    sourceProjectTitle: source?.title || ''
  })

  if (doc?.task) {
    showCreateDialog.value = false
    // 立即启动
    const settings = settingsStore.settings
    await designDocStore.startTask(doc.task.id, settings.apiKey, settings.baseUrl, settings.model)
    startPolling()
    ElMessage.success('文档已创建，开始生成中...')
    createForm.value = { sourceProjectId: '', title: '' }
  }
}

async function handleSubmit(doc: DesignDoc) {
  if (!settingsStore.isConfigured) {
    ElNotification.warning({ title: '配置提示', message: '请先在"设置"中配置AI参数', duration: 3000 })
    return
  }

  const settings = settingsStore.settings
  const result = await designDocStore.startTask(doc.id, settings.apiKey, settings.baseUrl, settings.model)
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
  background: var(--bg);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: var(--bg-white);
  border-bottom: 1px solid var(--border);
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
</style>
