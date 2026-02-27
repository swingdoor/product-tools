<template>
  <div class="prototype-list-page">
    <!-- 顶部标题栏 -->
    <header class="page-header">
      <div class="header-left">
        <h1 class="page-title">产品原型</h1>
        <span class="task-count">共 {{ prototypeStore.projects.length }} 个任务</span>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          新建任务
        </el-button>
      </div>
    </header>

    <!-- 任务列表表格 -->
    <main class="task-list-container">
      <el-empty v-if="!prototypeStore.projects.length" description="暂无原型任务，点击「新建任务」开始创建">
        <el-button type="primary" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          新建任务
        </el-button>
      </el-empty>

      <el-table
        v-else
        :data="prototypeStore.projects"
        style="width: 100%"
        row-key="id"
        class="task-table"
      >
        <el-table-column prop="id" label="任务ID" width="140">
          <template #default="{ row }">
            <span class="task-id">{{ row.id.slice(0, 8) }}...</span>
          </template>
        </el-table-column>

        <el-table-column prop="title" label="任务名称" min-width="160">
          <template #default="{ row }">
            <span class="task-name">{{ row.title }}</span>
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

        <el-table-column prop="updatedAt" label="更新时间" width="170" />

        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <!-- 未提交/生成中/失败 → 进入生成页 -->
              <el-button
                v-if="row.status !== 'completed'"
                type="primary"
                size="small"
                link
                @click="goToGeneratePage(row)"
              >
                进入生成页
              </el-button>

              <!-- 已完成 → 进入查看页 -->
              <el-button
                v-if="row.status === 'completed'"
                type="success"
                size="small"
                link
                @click="goToViewPage(row)"
              >
                进入查看页
              </el-button>

              <!-- 删除按钮 -->
              <el-popconfirm
                :title="row.status === 'generating' ? '删除后将取消生成任务，确定？' : '确定删除此任务？'"
                confirm-button-text="删除"
                cancel-button-text="取消"
                @confirm="deleteTask(row)"
              >
                <template #reference>
                  <el-button type="danger" size="small" link>删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </main>

    <!-- 新建任务弹窗 -->
    <el-dialog
      v-model="showCreateDialog"
      title="新建原型任务"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="createForm" label-position="top" class="create-form">
        <el-form-item label="任务名称" required>
          <el-input
            v-model="createForm.title"
            placeholder="输入任务名称，如：电商APP原型"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="产品需求分析">
          <el-select
            v-model="createForm.sourceAnalysisId"
            placeholder="选择已有的需求分析（可选）"
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
          <div class="form-tip">选择后将自动填充需求描述</div>
        </el-form-item>

        <el-form-item label="任务需求描述" required>
          <el-input
            v-model="createForm.analysisContent"
            type="textarea"
            :rows="6"
            placeholder="详细描述产品需求，包括功能模块、页面结构、交互逻辑等..."
          />
        </el-form-item>
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useProductPrototypeStore, type PrototypeProject, type TaskStatus } from '@/stores/productPrototype'
import { useProductAnalysisStore } from '@/stores/productAnalysis'

const router = useRouter()
const prototypeStore = useProductPrototypeStore()
const analysisStore = useProductAnalysisStore()

// 初始化时从数据库加载项目
onMounted(async () => {
  await prototypeStore.loadProjectsFromDB()
  await analysisStore.loadTasks() // 加载分析任务以供选择
})

// 新建弹窗
const showCreateDialog = ref(false)
const createForm = ref({
  title: '',
  clientType: 'Web端',
  sourceAnalysisId: '',
  analysisContent: ''
})

const canCreate = computed(() =>
  createForm.value.title.trim().length > 0 &&
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

function getStatusText(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    pending: '未提交',
    generating: '生成中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status]
}

function truncateText(text: string, maxLen: number): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
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
    analysisContent: ''
  }
}

// 仅创建任务
async function handleCreateOnly() {
  if (!canCreate.value) return

  await prototypeStore.createProject({
    title: createForm.value.title.trim(),
    clientType: createForm.value.clientType,
    sourceAnalysisId: createForm.value.sourceAnalysisId,
    analysisContent: createForm.value.analysisContent.trim(),
    data: null
  })

  showCreateDialog.value = false
  resetForm()
  ElMessage.success('任务创建成功')
}

// 创建并开始生成
async function handleCreateAndGenerate() {
  if (!canCreate.value) return

  const project = await prototypeStore.createProject({
    title: createForm.value.title.trim(),
    clientType: createForm.value.clientType,
    sourceAnalysisId: createForm.value.sourceAnalysisId,
    analysisContent: createForm.value.analysisContent.trim(),
    data: null
  })

  showCreateDialog.value = false
  resetForm()
  ElMessage.success('任务创建成功，开始生成...')
  router.push({ name: 'PrototypeGenerate', params: { id: project.id }, query: { action: 'generate' } })
}

// 进入生成页
function goToGeneratePage(project: PrototypeProject) {
  prototypeStore.setCurrentProject(project)
  router.push({ name: 'PrototypeGenerate', params: { id: project.id } })
}

// 进入查看页
function goToViewPage(project: PrototypeProject) {
  prototypeStore.setCurrentProject(project)
  router.push({ name: 'PrototypeView', params: { id: project.id } })
}

// 删除任务
async function deleteTask(project: PrototypeProject) {
  if (project.status === 'generating') {
    window.electronAPI?.removeAiListeners?.()
  }
  await prototypeStore.deleteProject(project.id)
  ElMessage.success('已删除')
}
</script>

<style scoped>
.prototype-list-page {
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
  border-radius: var(--radius-lg);
}

.task-id {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-tertiary);
}

.task-name {
  font-weight: 500;
  color: var(--text-primary);
}

.task-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.table-actions {
  display: flex;
  gap: 8px;
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
</style>
