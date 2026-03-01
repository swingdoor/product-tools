<template>
  <div class="market-list-page">
    <!-- 顶部工具栏 -->
    <header class="page-header">
      <div class="header-left">
        <h1 class="page-title">市场洞察</h1>
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
        <el-button type="primary" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          新建报告
        </el-button>
      </div>
    </header>

    <!-- 报告列表表格 -->
    <main class="page-content">
      <el-table
        :data="filteredTasks"
        style="width: 100%"
        class="task-table"
        :row-class-name="getRowClassName"
        @row-click="handleRowClick"
        v-loading="marketStore.loading"
      >
        <el-table-column prop="title" label="报告标题" min-width="200">
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
        <el-table-column prop="industry" label="行业领域" width="180" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
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
    </main>

    <!-- 新建报告弹窗 -->
    <el-dialog v-model="showCreateDialog" title="新建市场洞察报告" width="600px" @closed="resetForm">
      <el-form :model="createForm" label-position="top">
        <el-form-item label="报告标题">
          <el-input v-model="createForm.title" placeholder="输入报告标题（留空则自动生成）" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="行业 / 领域" required>
          <el-input
            v-model="createForm.industry"
            placeholder="例如：AI教育、新能源汽车、跨境电商..."
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="目标用户群体">
          <el-select
            v-model="createForm.targetUsersList"
            placeholder="选择或输入目标用户（可多选）"
            multiple
            filterable
            allow-create
            default-first-option
            style="width:100%"
          >
            <el-option v-for="u in targetUserOptions" :key="u" :label="u" :value="u" />
          </el-select>
        </el-form-item>
        <el-form-item label="核心关注方向">
          <el-checkbox-group v-model="createForm.focusAreas">
            <el-checkbox v-for="area in focusAreaOptions" :key="area" :label="area">{{ area }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="Deep Research (联网检索)">
          <div class="search-toggle-desc">
            <el-switch v-model="createForm.deepSearch" active-text="开启联网搜素" />
            <span class="tip-text">启用后将实时从互联网获取行业动态，分析更准确但耗时稍长。</span>
          </div>
        </el-form-item>
        <el-form-item label="参考数据源 (可选)">
          <el-input
            v-model="createForm.dataSources"
            type="textarea"
            placeholder="粘贴参考资料、数据摘要或补充背景信息..."
            :rows="3"
            maxlength="2000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!canCreate" :loading="creating" @click="handleCreate">
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
import { Plus, Loading, Search } from '@element-plus/icons-vue'
import { useMarketInsightStore, type MarketReport, type TaskStatus } from '@/stores/marketInsight'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const marketStore = useMarketInsightStore()
const settingsStore = useSettingsStore()

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
  deepSearch: true // 默认开启
})

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

function getStatusText(status: TaskStatus): string {
  const map = { pending: '待提交', generating: '执行中', completed: '已完成', failed: '失败' }
  return map[status] || '未知'
}

function getRowClassName({ row }: { row: MarketReport }): string {
  return row.status === 'generating' ? 'generating-row' : ''
}

// 重置表单
function resetForm() {
  createForm.value = { title: '', industry: '', targetUsersList: [], focusAreas: [], dataSources: '', deepSearch: true }
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
      deepSearch: !!createForm.value.deepSearch
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

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
