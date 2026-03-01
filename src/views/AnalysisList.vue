<template>
  <div class="analysis-list-page">
    <!-- 顶部工具栏 -->
    <header class="page-header">
      <div class="header-left">
        <span class="task-count">共 {{ analysisStore.tasks.length }} 个任务</span>
      </div>
      <div class="header-right">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索任务名称..."
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
            新建任务
          </el-button>
        </div>
      </div>
    </header>

    <!-- 任务列表表格 -->
    <main class="page-content">
      <!-- 表格视图 -->
      <el-table
        v-if="viewMode === 'table'"
        :data="filteredTasks"
        style="width: 100%"
        class="task-table"
        :row-class-name="getRowClassName"
        @row-click="handleRowClick"
        v-loading="analysisStore.loading"
      >
        <el-table-column prop="title" label="任务名称" width="340">
          <template #default="{ row }">
            <div class="task-name">
              <el-icon v-if="row.status === 'generating'" class="rotating" color="#165DFF"><Loading /></el-icon>
              <span>{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="sourceReportTitle" label="关联报告" width="180">
          <template #default="{ row }">
            <span v-if="row.sourceReportTitle" class="report-tag">{{ row.sourceReportTitle }}</span>
            <span v-else class="no-report">手动输入</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="引用知识" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.knowledgeRefDocs?.length" class="ref-docs-text">
              {{ getRefDocsNames(row.knowledgeRefDocs) }}
            </span>
            <span v-else class="no-ref-text">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
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
              >提交分析</el-button>

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
                title="确定删除此任务？"
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
          <el-empty description="暂无任务，点击右上角创建">
            <el-button type="primary" @click="showCreateDialog = true">新建任务</el-button>
          </el-empty>
        </template>
      </el-table>

      <!-- 卡片视图 -->
      <div v-else class="task-grid" v-loading="analysisStore.loading">
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
              >分析</el-button>
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
            <el-tag v-if="row.sourceReportTitle" size="small" type="primary" plain>
              关联：{{ row.sourceReportTitle }}
            </el-tag>
            <el-tag v-else size="small" type="info" plain>手动输入</el-tag>
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ getStatusText(row.status) }}
            </el-tag>
            <span v-if="row.knowledgeRefDocs?.length" class="card-ref-info">
              <el-icon><Document /></el-icon>
              知识: {{ row.knowledgeRefDocs.length }}
            </span>
          </div>

          <!-- 第三行：描述摘要和日期 -->
          <div class="card-footer">
            <div class="card-desc" v-if="row.inputContent">
              {{ row.inputContent.substring(0, 80) }}...
            </div>
            <div class="card-date">{{ formatDate(row.createdAt) }}</div>
          </div>
        </div>
        <div v-if="!filteredTasks.length" class="empty-wrapper">
          <el-empty description="暂无任务" />
        </div>
      </div>
    </main>

    <!-- 新建任务弹窗 -->
    <el-dialog v-model="showCreateDialog" title="新建需求分析任务" width="680px" @closed="resetForm" :close-on-click-modal="false" class="ant-dialog">
      <el-form :model="createForm" label-position="top" class="compact-form">
        <div class="form-section">
          <div class="section-title">基础配置</div>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="任务名称" required>
                <el-input v-model="createForm.title" placeholder="输入任务名称" maxlength="50" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="关联市场报告（可选）" class="report-select-item">
                <el-select
                  v-model="createForm.sourceReportId"
                  placeholder="选择历史报告..."
                  clearable
                  filterable
                  style="width: 100%"
                  @change="onSelectReport"
                >
                  <el-option
                    v-for="r in marketStore.tasks"
                    :key="r.id"
                    :value="r.id"
                    :label="`${r.industry} 市场报告 (${r.createdAt?.split(' ')[0]})`"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <div class="form-section">
          <div class="section-title">分析内容与参考</div>
          <el-form-item label="分析内容输入" required>
            <el-input
              v-model="createForm.inputContent"
              type="textarea"
              :rows="4"
              placeholder="粘贴市场报告内容 or 手动输入需要分析的内容..."
              maxlength="10000"
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
          <el-button type="primary" :disabled="!canCreate" @click="handleCreate">
            创建并开始分析
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElNotification } from 'element-plus'
import { Plus, Loading, Search, Menu, Grid } from '@element-plus/icons-vue'
import { useProductAnalysisStore, type AnalysisTask, type TaskStatus } from '@/stores/productAnalysis'
import { useMarketInsightStore } from '@/stores/marketInsight'
import { useSettingsStore } from '@/stores/settings'
import { knowledgeApi } from '@/api/knowledgeApi'
import { formatDate } from '@/utils/formatDate'
import { getStatusType, getStatusText } from '@/utils/taskUtils'
import { useTaskPolling } from '@/composables/useTaskPolling'

const router = useRouter()
const analysisStore = useProductAnalysisStore()
const marketStore = useMarketInsightStore()
const settingsStore = useSettingsStore()

// 视图模式
const viewMode = ref(localStorage.getItem('analysisViewMode') || 'table')
watch(viewMode, (val) => {
  localStorage.setItem('analysisViewMode', val)
})

// 搜索和筛选
const searchKeyword = ref('')
const statusFilter = ref('')

// 创建表单
const showCreateDialog = ref(false)
const createForm = ref({
  title: '',
  sourceReportId: '',
  sourceReportTitle: '',
  inputContent: '',
  knowledgeRefMode: 'none' as 'none' | 'auto' | 'manual',
  knowledgeRefDocs: [] as string[]
})

// 知识库文档
const availableDocs = ref<any[]>([])

// 轮询管理
const { startPolling, stopPolling } = useTaskPolling(
  () => analysisStore.loadTasks(),
  () => analysisStore.tasks.some(t => t.status === 'generating')
)

// 过滤后的任务列表
const filteredTasks = computed(() => {
  return analysisStore.tasks.filter(task => {
    const matchKeyword = !searchKeyword.value || 
      task.title.toLowerCase().includes(searchKeyword.value.toLowerCase())
    const matchStatus = !statusFilter.value || task.status === statusFilter.value
    return matchKeyword && matchStatus
  })
})

const canCreate = computed(() => {
  return createForm.value.title.trim() && 
    createForm.value.inputContent.trim().length > 0 &&
    settingsStore.isConfigured
})

// 获取引用文档名称列表
function getRefDocsNames(docIds?: string[]): string {
  if (!docIds || docIds.length === 0) return '-'
  return docIds
    .map(id => availableDocs.value.find(d => d.id === id)?.filename)
    .filter(name => !!name)
    .join(', ')
}

// 状态映射






function getRowClassName({ row }: { row: AnalysisTask }): string {
  return row.status === 'generating' ? 'generating-row' : ''
}

// 选择市场报告
function onSelectReport(id: string) {
  if (!id) {
    createForm.value.sourceReportTitle = ''
    createForm.value.inputContent = ''
    return
  }
  const task = marketStore.getTaskById(id)
  if (task) {
    createForm.value.sourceReportTitle = `${task.industry} 市场洞察报告`
    createForm.value.inputContent = task.resultContent || ''
    ElMessage.success('已导入市场报告内容')
  }
}

// 重置表单
function resetForm() {
  createForm.value = { 
    title: '', sourceReportId: '', sourceReportTitle: '', inputContent: '',
    knowledgeRefMode: 'none', knowledgeRefDocs: []
  }
}

// 创建任务
async function handleCreate() {
  if (!settingsStore.isConfigured) {
    ElNotification.warning({ title: '请先配置AI', message: '前往"设置"配置API Key', duration: 3000 })
    return
  }

  // 创建任务
  const task = await analysisStore.createTask({
    title: createForm.value.title,
    sourceReportId: createForm.value.sourceReportId || undefined,
    sourceReportTitle: createForm.value.sourceReportTitle || undefined,
    inputContent: createForm.value.inputContent,
    knowledgeRefMode: createForm.value.knowledgeRefMode,
    knowledgeRefDocs: [...createForm.value.knowledgeRefDocs]
  })

  if (task) {
    // 立即启动分析
    const result = await analysisStore.startTask(
      task.id
    )

    if (result.success) {
      ElMessage.success('任务已创建并开始分析')
      showCreateDialog.value = false
      startPolling()
    } else {
      ElMessage.error(result.error || '启动分析失败')
    }
  } else {
    ElMessage.error('创建任务失败')
  }
}

// 取消任务
async function handleCancel(task: AnalysisTask) {
  await analysisStore.cancelTask(task.id)
  ElMessage.info('已取消任务')
}

// 提交分析（重新启动 pending 状态的任务）
async function handleSubmit(task: AnalysisTask) {
  if (!settingsStore.isConfigured) {
    ElNotification.warning({ title: '请先配置AI', message: '前往“设置”配置API Key', duration: 3000 })
    return
  }

  try {
    const result = await analysisStore.startTask(
      task.id
    )

    if (result.success) {
      ElMessage.success('已提交分析')
      startPolling()
    } else {
      ElMessage.error(result.error || '启动分析失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '启动分析失败')
  }
}

// 删除任务
async function handleDelete(id: string) {
  const success = await analysisStore.deleteTask(id)
  if (success) {
    ElMessage.success('删除成功')
  }
}

// 跳转查看
function goToView(id: string) {
  router.push({ name: 'AnalysisView', params: { id } })
}

// 行点击
function handleRowClick(row: AnalysisTask) {
  if (row.status === 'completed') {
    goToView(row.id)
  }
}



// 生命周期
onMounted(async () => {
  await analysisStore.loadTasks()
  if (analysisStore.generatingCount > 0) {
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
.analysis-list-page {
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

.report-tag {
  font-size: 12px;
  color: var(--primary);
  background: #E8F3FF;
  padding: 2px 8px;
  border-radius: 4px;
}

.no-report {
  font-size: 12px;
  color: var(--text-tertiary);
}

:deep(.generating-row) {
  background: #FFFBE6 !important;
}

.rotating {
  animation: rotating 1s linear infinite;
}

.ref-docs-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.no-ref-text {
  color: var(--text-tertiary);
}

.card-ref-info {
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
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

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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
