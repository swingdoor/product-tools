<template>
  <div class="design-doc-list-page">
    <!-- 顶部工具栏 -->
    <header class="page-header">
      <div class="header-left">
        <h1 class="page-title">设计文档</h1>
        <span class="task-count">共 {{ designDocStore.docs.length }} 份文档</span>
      </div>
      <div class="header-right">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索标题或原型项目..."
          prefix-icon="Search"
          clearable
          style="width: 220px"
        />
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 120px">
          <el-option label="全部" value="" />
          <el-option label="待生成" value="pending" />
          <el-option label="生成中" value="generating" />
          <el-option label="已完成" value="completed" />
          <el-option label="失败" value="failed" />
        </el-select>
        <el-button type="primary" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          新建文档
        </el-button>
      </div>
    </header>

    <!-- 文档列表表格 -->
    <main class="page-content">
      <el-table
        :data="filteredDocs"
        style="width: 100%"
        :row-class-name="getRowClassName"
        @row-click="handleRowClick"
        v-loading="designDocStore.loading"
      >
        <el-table-column prop="title" label="文档标题" min-width="200">
          <template #default="{ row }">
            <div class="doc-name">
              <el-icon v-if="row.status === 'generating'" class="rotating" color="#165DFF"><Loading /></el-icon>
              <span>{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="sourceProjectTitle" label="关联原型" width="200">
          <template #default="{ row }">
            <el-tooltip :content="row.sourceProjectTitle" placement="top">
              <span class="source-project">{{ row.sourceProjectTitle }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="pageCount" label="页面数" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ row.pageCount }} 页</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="130">
          <template #default="{ row }">
            <div class="status-cell">
              <el-tag :type="getStatusType(row.status)" size="small" effect="light">
                {{ getStatusText(row.status) }}
              </el-tag>
              <span v-if="row.status === 'generating' && row.progress" class="progress-text">
                {{ row.progress.percentage || 0 }}%
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'pending'"
              type="primary"
              size="small"
              @click.stop="handleSubmit(row)"
            >提交生成</el-button>
            <el-button
              v-if="row.status === 'completed'"
              type="primary"
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
              v-if="row.status === 'completed' || row.status === 'failed' || row.status === 'pending'"
              title="确定删除此文档？"
              @confirm="handleDelete(row.id)"
            >
              <template #reference>
                <el-button type="danger" size="small" plain @click.stop>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无文档，点击右上角创建">
            <el-button type="primary" @click="showCreateDialog = true">新建文档</el-button>
          </el-empty>
        </template>
      </el-table>
    </main>

    <!-- 新建文档弹窗 -->
    <el-dialog v-model="showCreateDialog" title="新建设计文档" width="500px" @closed="resetForm">
      <el-form :model="createForm" label-position="top">
        <el-form-item label="选择原型项目" required>
          <el-select
            v-model="createForm.sourceProjectId"
            placeholder="请选择已完成的原型项目"
            filterable
            style="width: 100%"
            :loading="loadingProjects"
          >
            <el-option
              v-for="project in completedProjects"
              :key="project.id"
              :label="project.title"
              :value="project.id"
            >
              <div class="project-option">
                <span>{{ project.title }}</span>
                <span class="page-count">{{ project.data?.pages?.length || 0 }} 页</span>
              </div>
            </el-option>
          </el-select>
          <div v-if="completedProjects.length === 0 && !loadingProjects" class="no-project-tip">
            <el-text type="warning" size="small">
              暂无已完成的原型项目，请先在"产品原型"模块生成原型
            </el-text>
          </div>
        </el-form-item>
        <el-form-item label="文档标题">
          <el-input
            v-model="createForm.title"
            placeholder="输入文档标题（留空则自动生成）"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!canCreate" :loading="creating" @click="handleCreate">
          <el-icon><Plus /></el-icon>
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
import { useSettingsStore } from '@/stores/settings'
import type { PrototypeProject } from '@/electron.d'

const router = useRouter()
const designDocStore = useDesignDocStore()
const settingsStore = useSettingsStore()

// 搜索和筛选
const searchKeyword = ref('')
const statusFilter = ref('')

// 已完成的原型项目列表
const completedProjects = ref<PrototypeProject[]>([])
const loadingProjects = ref(false)

// 创建表单
const showCreateDialog = ref(false)
const creating = ref(false)
const createForm = ref({
  sourceProjectId: '',
  title: ''
})

// 轮询定时器
let pollTimer: ReturnType<typeof setInterval> | null = null
const POLL_INTERVAL = 3000

// 过滤后的文档列表
const filteredDocs = computed(() => {
  return designDocStore.docs.filter(doc => {
    const matchKeyword = !searchKeyword.value || 
      doc.title.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      doc.sourceProjectTitle.toLowerCase().includes(searchKeyword.value.toLowerCase())
    const matchStatus = !statusFilter.value || doc.status === statusFilter.value
    return matchKeyword && matchStatus
  })
})

// 能否创建文档（必须选择原型项目）
const canCreate = computed(() => {
  return createForm.value.sourceProjectId && settingsStore.isConfigured
})

// 获取选中的原型项目
const selectedProject = computed(() => {
  return completedProjects.value.find(p => p.id === createForm.value.sourceProjectId)
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
  const map = { pending: '待生成', generating: '生成中', completed: '已完成', failed: '失败' }
  return map[status] || '未知'
}

function getRowClassName({ row }: { row: DesignDoc }): string {
  return row.status === 'generating' ? 'generating-row' : ''
}

// 加载已完成的原型项目
async function loadCompletedProjects() {
  loadingProjects.value = true
  try {
    const result = await window.electronAPI.dbGetProjects()
    if (result.success && result.data) {
      completedProjects.value = result.data.filter(p => p.status === 'completed')
    }
  } finally {
    loadingProjects.value = false
  }
}

// 重置表单
function resetForm() {
  createForm.value = { sourceProjectId: '', title: '' }
}

// 创建文档
async function handleCreate() {
  if (creating.value) return
  
  if (!settingsStore.isConfigured) {
    ElNotification.warning({ title: '请先配置AI', message: '前往"设置"配置API Key', duration: 3000 })
    return
  }

  if (!selectedProject.value) {
    ElMessage.warning('请选择原型项目')
    return
  }

  creating.value = true
  try {
    // 自动生成标题
    const title = createForm.value.title || `${selectedProject.value.title} - 设计文档`

    // 创建文档
    const { doc, error: createError } = await designDocStore.createDoc({
      title,
      sourceProject: selectedProject.value
    })

    if (doc) {
      // 立即启动生成
      const settings = settingsStore.settings
      const result = await designDocStore.startGenerate(
        doc.id,
        settings.apiKey,
        settings.baseUrl,
        settings.model
      )

      if (result.success) {
        ElMessage.success('文档已创建并开始生成')
        showCreateDialog.value = false
        startPolling()
      } else {
        ElMessage.error(result.error || '启动生成失败')
      }
    } else {
      ElMessage.error(createError || '创建文档失败')
    }
  } catch (err) {
    console.error('创建文档异常:', err)
    ElMessage.error('创建文档时发生错误')
  } finally {
    creating.value = false
  }
}

// 提交生成
async function handleSubmit(doc: DesignDoc) {
  if (!settingsStore.isConfigured) {
    ElNotification.warning({ title: '请先配置AI', message: '前往"设置"配置API Key', duration: 3000 })
    return
  }

  const settings = settingsStore.settings
  const result = await designDocStore.startGenerate(
    doc.id,
    settings.apiKey,
    settings.baseUrl,
    settings.model
  )

  if (result.success) {
    ElMessage.success('已提交生成')
    startPolling()
  } else {
    ElMessage.error(result.error || '启动生成失败')
  }
}

// 取消生成
async function handleCancel(doc: DesignDoc) {
  await designDocStore.cancelGenerate(doc.id)
  ElMessage.info('已取消生成')
}

// 删除文档
async function handleDelete(id: string) {
  const success = await designDocStore.deleteDoc(id)
  if (success) {
    ElMessage.success('删除成功')
  }
}

// 跳转查看
function goToView(id: string) {
  router.push({ name: 'DesignDocView', params: { id } })
}

// 行点击
function handleRowClick(row: DesignDoc) {
  if (row.status === 'completed') {
    goToView(row.id)
  }
}

// 轮询
function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    if (designDocStore.generatingCount > 0) {
      await designDocStore.loadDocs()
    }
  }, POLL_INTERVAL)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// 生命周期
onMounted(async () => {
  await Promise.all([
    designDocStore.loadDocs(),
    loadCompletedProjects()
  ])
  if (designDocStore.generatingCount > 0) {
    startPolling()
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.design-doc-list-page {
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

.doc-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.source-project {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
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
