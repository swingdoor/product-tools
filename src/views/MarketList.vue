<template>
  <div class="market-list-page">
    <!-- 顶部工具栏 -->
    <header class="page-header">
      <div class="header-left">
        <span class="task-count">共 {{ marketStore.tasks.length }} 份报告</span>
      </div>
      <div class="header-right">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索行业或标题..."
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
            新建报告
          </el-button>
        </div>
      </div>
    </header>

    <!-- 报告列表表格 -->
    <main class="page-content">
      <!-- 表格视图 -->
      <el-table
        v-if="viewMode === 'table'"
        :data="filteredTasks"
        style="width: 100%"
        class="task-table"
        :row-class-name="getRowClassName"
        @row-click="handleRowClick"
        v-loading="marketStore.loading"
      >
        <el-table-column prop="title" label="报告标题" width="340">
          <template #default="{ row }">
            <div class="report-name">
              <el-icon v-if="row.status === 'generating'" class="rotating" color="#165DFF"><Loading /></el-icon>
              <span>{{ row.title }}</span>
              <el-tooltip content="该报告已开启 Deep Research 联网检索" placement="top">
                <el-tag v-if="row.deepSearch" size="small" type="warning" effect="dark" class="search-badge">
                  Deep Research
                </el-tag>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="industry" label="行业领域" width="160" />
        <el-table-column label="引用知识" width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.knowledgeRefDocs?.length" class="ref-docs-text">
              {{ getRefDocsNames(row.knowledgeRefDocs) }}
            </span>
            <span v-else class="no-ref-text">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ getStatusText(row.status) }}
            </el-tag>
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
                title="确定删除此报告？"
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
          <el-empty description="暂无报告，点击右上角创建">
            <el-button type="primary" @click="showCreateDialog = true">新建报告</el-button>
          </el-empty>
        </template>
      </el-table>

      <!-- 卡片视图 -->
      <div v-else class="task-grid" v-loading="marketStore.loading">
        <div v-for="row in filteredTasks" :key="row.id" class="task-card" @click="handleRowClick(row)">
          <!-- 第一行：标题和操作 -->
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
              >提交</el-button>
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

          <!-- 第二行：核心信息 -->
          <div class="card-meta">
            <el-tag size="small" effect="plain">{{ row.industry }}</el-tag>
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ getStatusText(row.status) }}
            </el-tag>
            <el-tag v-if="row.deepSearch" size="small" type="warning" plain>Deep Research</el-tag>
            <span v-if="row.knowledgeRefDocs?.length" class="card-ref-info">
              <el-icon><Document /></el-icon>
              知识: {{ row.knowledgeRefDocs.length }}
            </span>
          </div>

          <!-- 第三行：详情和日期 -->
          <div class="card-footer">
            <div class="focus-areas" v-if="row.focusAreas && row.focusAreas.length">
              关注：{{ row.focusAreas.join('、') }}
            </div>
            <div class="card-date">{{ formatDate(row.createdAt) }}</div>
          </div>
        </div>
        <div v-if="!filteredTasks.length" class="empty-wrapper">
          <el-empty description="暂无报告" />
        </div>
      </div>
    </main>

    <!-- 新建任务弹窗 -->
    <el-dialog v-model="showCreateDialog" title="新建市场洞察任务" width="680px" @closed="resetForm" :close-on-click-modal="false" class="ant-dialog">
      <el-form :model="createForm" label-position="top" class="compact-form">
        <div class="form-section">
          <div class="section-title">基础配置</div>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="任务名称">
                <el-input v-model="createForm.title" placeholder="输入任务标题（自动生成）" maxlength="50" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="行业 / 领域" required>
                <el-input v-model="createForm.industry" placeholder="如：新能源汽车、AI教育" maxlength="50" />
              </el-form-item>
            </el-col>
          </el-row>
          
          <el-form-item label="目标用户群体">
            <el-select
              v-model="createForm.targetUsersList"
              placeholder="请选择或输入目标用户（可多选）"
              multiple
              filterable
              allow-create
              style="width:100%"
            >
              <el-option v-for="u in targetUserOptions" :key="u" :label="u" :value="u" />
            </el-select>
          </el-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">报告配置与参考</div>
          <el-form-item label="核心关注方向">
            <el-checkbox-group v-model="createForm.focusAreas">
              <el-checkbox v-for="area in focusAreaOptions" :key="area" :label="area">{{ area }}</el-checkbox>
            </el-checkbox-group>
          </el-form-item>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="联网搜索 (Deep Research)">
                <el-switch v-model="createForm.deepSearch" size="small" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="引用知识库">
                <el-radio-group v-model="createForm.knowledgeRefMode" size="small" class="compact-radio">
                  <el-radio value="none">不引用</el-radio>
                  <el-radio value="auto">自动</el-radio>
                  <el-radio value="manual">手动</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item v-if="createForm.knowledgeRefMode === 'manual'" class="compact-item">
            <el-select
              v-model="createForm.knowledgeRefDocs"
              multiple
              filterable
              placeholder="选择知识库文档..."
              style="width: 100%"
            >
              <el-option v-for="doc in availableDocs" :key="doc.id" :label="doc.filename" :value="doc.id" />
            </el-select>
          </el-form-item>

          <el-form-item label="自定义背景/数据源 (可选)">
            <el-input
              v-model="createForm.dataSources"
              type="textarea"
              placeholder="粘贴参考资料、背景内容等..."
              :rows="2"
              maxlength="2000"
              resize="none"
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!canCreate" :loading="creating" @click="handleCreate">
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
import { useMarketInsightStore, type MarketReport, type TaskStatus } from '@/stores/marketInsight'
import { useSettingsStore } from '@/stores/settings'
import { knowledgeApi } from '@/api/knowledgeApi'

const router = useRouter()
const marketStore = useMarketInsightStore()
const settingsStore = useSettingsStore()

// 视图模式
const viewMode = ref(localStorage.getItem('marketViewMode') || 'table')
watch(viewMode, (val) => {
  localStorage.setItem('marketViewMode', val)
})

// 搜索和筛选
const searchKeyword = ref('')
const statusFilter = ref('')

// 创建表单
const showCreateDialog = ref(false)
const creating = ref(false)
const createForm = ref({
  title: '',
  industry: '',
  targetUsersList: [] as string[],
  focusAreas: [] as string[],
  dataSources: '',
  deepSearch: true, // 默认开启
  knowledgeRefMode: 'none' as 'none' | 'auto' | 'manual',
  knowledgeRefDocs: [] as string[]
})

const availableDocs = ref<any[]>([])

// 预设选项
const targetUserOptions = ['企业决策者', 'B端客户', 'C端用户', '开发者', '创业者', '投资人', '产品经理']
const focusAreaOptions = ['市场规模', '竞争格局', '用户画像', '技术趋势', '商业模式', '投资热点']

// 轮询定时器
let pollTimer: ReturnType<typeof setInterval> | null = null
const POLL_INTERVAL = 3000

// 过滤后的任务列表
const filteredTasks = computed(() => {
  return marketStore.tasks.filter(task => {
    const matchKeyword = !searchKeyword.value || 
      task.title.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      task.industry.toLowerCase().includes(searchKeyword.value.toLowerCase())
    const matchStatus = !statusFilter.value || task.status === statusFilter.value
    return matchKeyword && matchStatus
  })
})

// 能否创建报告（行业必填，标题可自动生成）
const canCreate = computed(() => {
  return !!createForm.value.industry.trim()
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
  const map = { pending: '待提交', generating: '执行中', completed: '已完成', failed: '失败' }
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

function getRowClassName({ row }: { row: MarketReport }): string {
  return row.status === 'generating' ? 'generating-row' : ''
}

// 重置表单
function resetForm() {
  createForm.value = { 
    title: '', industry: '', targetUsersList: [], focusAreas: [], dataSources: '', 
    deepSearch: true, knowledgeRefMode: 'none', knowledgeRefDocs: [] 
  }
}

// 创建报告
async function handleCreate() {
  if (creating.value) return
  
  if (!settingsStore.isConfigured) {
    ElNotification.warning({ title: '请先配置AI', message: '前往“设置”配置API Key', duration: 3000 })
    return
  }

  creating.value = true
  try {
    console.log('[MarketList] Starting handleCreate', JSON.parse(JSON.stringify(createForm.value)))
    
    // 自动生成标题
    const title = createForm.value.title || `${createForm.value.industry} 市场洞察报告`
    
    // 确保数据是非响应式的纯对象
    const targetUsers = (createForm.value.targetUsersList || []).join(',')
    const focusAreas = [...(createForm.value.focusAreas || [])]

    const { task, error: createError } = await marketStore.createTask({
      title,
      industry: String(createForm.value.industry || ''),
      targetUsers,
      focusAreas,
      dataSources: String(createForm.value.dataSources || ''),
      deepSearch: !!createForm.value.deepSearch,
      knowledgeRefMode: createForm.value.knowledgeRefMode,
      knowledgeRefDocs: [...createForm.value.knowledgeRefDocs]
    })

    console.log('[MarketList] Task created result:', { task, createError })
    
    if (task) {
      const result = await marketStore.startTask(
        task.id,
        settingsStore.settings.searchConfig
      )
      
      if (result.success) {
        ElMessage.success('报告已创建并开始生成')
        showCreateDialog.value = false
        startPolling()
      } else {
        ElMessage.error(result.error || '启动生成失败')
      }
    } else {
      ElMessage.error(createError || '创建报告失败')
    }
  } catch (err: any) {
    console.error('创建报告异常:', err)
    ElMessage.error(`创建报告时发生错误: ${err.message || String(err)}`)
  } finally {
    creating.value = false
  }
}

// 提交生成（重新启动 pending 状态的报告）
async function handleSubmit(task: MarketReport) {
  if (!settingsStore.isConfigured) {
    ElNotification.warning({ title: '请先配置AI', message: '前往"设置"配置API Key', duration: 3000 })
    return
  }
  try {
    const result = await marketStore.startTask(
      task.id,
      settingsStore.settings.searchConfig
    )

    if (result.success) {
      ElMessage.success('已提交生成')
      startPolling()
    } else {
      ElMessage.error(result.error || '启动生成失败')
    }
  } catch (err: any) {
    console.error('重新提交报告异常:', err)
    ElMessage.error(`重新提交报告时发生错误: ${err.message || String(err)}`)
  }
}

// 取消生成
async function handleCancel(task: MarketReport) {
  await marketStore.cancelTask(task.id)
  ElMessage.info('已取消生成')
}

// 删除报告
async function handleDelete(id: string) {
  const success = await marketStore.deleteTask(id)
  if (success) {
    ElMessage.success('删除成功')
  }
}

// 跳转查看
function goToView(id: string) {
  router.push({ name: 'MarketView', params: { id } })
}

// 行点击
function handleRowClick(row: MarketReport) {
  if (row.status === 'completed') {
    goToView(row.id)
  }
}

// 轮询
function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    // 只有有执行中报告时才轮询
    if (marketStore.generatingCount > 0) {
      await marketStore.loadTasks()
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
  await marketStore.loadTasks()
  if (marketStore.generatingCount > 0) {
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
.market-list-page {
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

.search-toggle-desc {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tip-text {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

.report-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  width: 100%;
  overflow: hidden;
}

.report-name span {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.search-badge {
  font-size: 11px;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  font-weight: bold;
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

.focus-areas {
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
