<template>
  <div class="prototype-generate-page">
    <!-- 顶部导航栏 -->
    <header class="page-header">
      <div class="header-left">
        <el-button text @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回列表
        </el-button>
        <el-divider direction="vertical" />
        <span class="project-title">{{ currentProject?.title || '任务生成' }}</span>
        <el-tag size="small" :type="getStatusType()" effect="plain">
          {{ getStatusText() }}
        </el-tag>
      </div>
    </header>

    <!-- 主体内容区域 -->
    <main class="page-content">
      <!-- 状态1：未提交 - 展示需求描述和开始生成按钮 -->
      <div v-if="currentProject?.status === 'pending'" class="pending-state">
        <div class="state-card">
          <div class="card-icon">
            <el-icon size="64" color="#165DFF"><Document /></el-icon>
          </div>
          <h2 class="card-title">任务需求描述</h2>
          <div class="requirement-content">
            <el-scrollbar max-height="300px">
              <p class="requirement-text">{{ currentProject?.analysisContent }}</p>
            </el-scrollbar>
          </div>
          <el-button
            type="primary"
            size="large"
            :disabled="!canGenerate"
            @click="startGenerate"
            class="start-btn"
          >
            <el-icon><MagicStick /></el-icon>
            开始生成
          </el-button>
        </div>
      </div>

      <!-- 状态2：生成中 - 展示进度条和步骤信息 -->
      <div v-else-if="currentProject?.status === 'generating' || isGenerating" class="generating-state">
        <div class="state-card">
          <!-- 步骤指示器 -->
          <div class="gen-steps">
            <div class="gen-step" :class="{ active: genStep === 'plan', done: ['pages', 'done'].includes(genStep) }">
              <div class="step-circle">
                <el-icon v-if="['pages', 'done'].includes(genStep)"><Check /></el-icon>
                <el-icon v-else-if="genStep === 'plan'" class="rotating"><Loading /></el-icon>
                <span v-else>1</span>
              </div>
              <div class="step-info">
                <span class="step-label">步骤1：页面规划</span>
                <span class="step-desc">分析需求，确定页面架构</span>
              </div>
            </div>
            <div class="gen-step-line" :class="{ done: ['pages', 'done'].includes(genStep) }" />
            <div class="gen-step" :class="{ active: genStep === 'pages', done: genStep === 'done' }">
              <div class="step-circle">
                <el-icon v-if="genStep === 'done'"><Check /></el-icon>
                <el-icon v-else-if="genStep === 'pages'" class="rotating"><Loading /></el-icon>
                <span v-else>2</span>
              </div>
              <div class="step-info">
                <span class="step-label">步骤2：HTML页面生成</span>
                <span class="step-desc">
                  <template v-if="genStep === 'pages'">
                    正在生成第 {{ genCurrentPage }}/{{ genTotalPages }} 页：{{ genCurrentPageName }}
                  </template>
                  <template v-else>为每个页面生成完整HTML代码</template>
                </span>
              </div>
            </div>
          </div>

          <!-- 进度条 -->
          <div class="progress-section">
            <el-progress
              :percentage="genProgress"
              :status="genStep === 'error' ? 'exception' : genStep === 'done' ? 'success' : undefined"
              :striped="isGenerating"
              :striped-flow="isGenerating"
              :stroke-width="12"
              style="width: 100%"
            />
            <span class="progress-text">{{ genProgressText }}</span>
          </div>

          <!-- 已完成页面列表 -->
          <div v-if="genCompletedPages.length" class="completed-pages">
            <div class="completed-label">已完成页面</div>
            <div class="completed-list">
              <el-tag v-for="p in genCompletedPages" :key="p.id" type="success" size="small" effect="light">
                <el-icon><Check /></el-icon>
                {{ p.name }}
              </el-tag>
            </div>
          </div>

          <!-- 错误状态 -->
          <div v-if="genStep === 'error'" class="error-section">
            <el-icon color="#F53F3F" size="20"><CircleClose /></el-icon>
            <span>{{ errorMessage }}</span>
            <el-button type="primary" size="small" @click="startGenerate">重试</el-button>
          </div>

          <!-- 取消按钮 -->
          <el-button v-if="isGenerating" plain @click="cancelGenerate" class="cancel-btn">
            取消生成
          </el-button>

          <!-- 任务日志 (合并到卡片中) -->
          <div class="card-logs">
            <div class="card-logs-header">
              <span class="log-title">
                <el-icon><Document /></el-icon>
                任务日志
              </span>
            </div>
            <div class="card-logs-content">
              <el-scrollbar max-height="240px">
                <div v-if="taskLogs.length === 0" class="log-empty">
                  <template v-if="currentProject?.status === 'generating'">
                    <el-icon class="rotating" color="#165DFF"><Loading /></el-icon>
                    <span>任务正在后台生成中...</span>
                  </template>
                  <template v-else>
                    暂无日志
                  </template>
                </div>
                <div v-else class="log-list">
                  <div v-for="log in taskLogs" :key="log.id" class="log-item">
                    <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
                    <el-tag :type="getLogTagType(log.type)" size="small" effect="light">
                      {{ getLogLabel(log.type) }}
                    </el-tag>
                    <span class="log-message">{{ log.message }}</span>
                  </div>
                </div>
              </el-scrollbar>
            </div>
          </div>
        </div>
      </div>

      <!-- 状态3：失败 - 展示错误信息和重试按钮 -->
      <div v-else-if="currentProject?.status === 'failed'" class="failed-state">
        <div class="state-card">
          <div class="card-icon">
            <el-icon size="64" color="#F53F3F"><CircleClose /></el-icon>
          </div>
          <h2 class="card-title">生成失败</h2>
          <p class="error-message">{{ currentProject?.errorMessage || '未知错误，请重试' }}</p>
          <el-button type="primary" size="large" @click="startGenerate" class="retry-btn">
            <el-icon><RefreshRight /></el-icon>
            重新生成
          </el-button>
        </div>
      </div>

      <!-- 状态4：无效/已完成状态 - 如果不是正在生成且没有动作，则展示跳转按钮 -->
      <div v-else-if="!isGenerating && !route.query.action" class="invalid-state">
        <el-empty description="该任务已完成，请前往查看页">
          <el-button type="primary" @click="goToViewPage">进入查看页</el-button>
        </el-empty>
      </div>

      <!-- 备用状态：如果是正在生成或者有生成动作，但当前状态不是 pending/failed/generating，
           这种情况下显示生成中状态的占位，防止闪烁 -->
      <div v-else class="generating-state">
         <div class="state-card">
           <div class="card-icon">
             <el-icon class="rotating" size="64" color="#165DFF"><Loading /></el-icon>
           </div>
           <p>正在初始化生成环境...</p>
         </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElNotification } from 'element-plus'
import { useProductPrototypeStore, type TaskLogType, type GenStep } from '@/stores/productPrototype'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const route = useRoute()
const prototypeStore = useProductPrototypeStore()
const settingsStore = useSettingsStore()

// 当前项目
const currentProject = computed(() => prototypeStore.currentTask)

// 任务日志
const taskLogs = computed(() => prototypeStore.currentTaskLogs)
const showLogs = ref(true)

// 生成状态 - 从数据库读取
const genStep = computed<GenStep>(() => currentProject.value?.progress?.step || 'idle')
const isGenerating = computed(() => currentProject.value?.status === 'generating')
const genTotalPages = computed(() => currentProject.value?.progress?.totalPages || 0)
const genCurrentPage = computed(() => currentProject.value?.progress?.currentPage || 0)
const genCurrentPageName = computed(() => currentProject.value?.progress?.currentPageName || '')
const genCompletedPages = computed(() => currentProject.value?.progress?.completedPages || [])
const errorMessage = computed(() => currentProject.value?.progress?.errorMessage || currentProject.value?.errorMessage || '')

// 状态轮询间隔（2秒）
const POLL_INTERVAL_MS = 2 * 1000

// 轮询定时器
let pollInterval: ReturnType<typeof setInterval> | null = null

// 进度计算
const genProgress = computed(() => {
  if (genStep.value === 'idle') {
    // 如果任务状态是 generating 但 genStep 是 idle，说明是后台生成中
    if (currentProject.value?.status === 'generating') return 50
    return 0
  }
  if (genStep.value === 'plan') return 10
  if (genStep.value === 'done') return 100
  if (genStep.value === 'error') return genCurrentPage.value > 0 ? Math.floor(10 + (genCurrentPage.value / genTotalPages.value) * 90) : 10
  if (genTotalPages.value === 0) return 10
  return Math.floor(10 + (genCurrentPage.value / genTotalPages.value) * 90)
})

const genProgressText = computed(() => {
  if (genStep.value === 'idle') {
    // 如果任务状态是 generating 但 genStep 是 idle，说明是后台生成中
    if (currentProject.value?.status === 'generating') return '正在后台生成中，请稍候...'
    return '准备中...'
  }
  if (genStep.value === 'plan') return '正在规划页面架构...'
  if (genStep.value === 'pages') {
    if (genTotalPages.value > 0) {
      return `正在生成页面 ${genCurrentPage.value}/${genTotalPages.value}`
    }
    return '正在生成页面...'
  }
  if (genStep.value === 'done') return '生成完成！'
  if (genStep.value === 'error') return '生成失败'
  return ''
})

const canGenerate = computed(() => settingsStore.isConfigured)

// 日志相关方法
function formatLogTime(timestamp: string): string {
  const date = new Date(timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
}

function getLogTagType(type: TaskLogType): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  const map: Record<TaskLogType, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
    create: 'primary',
    status_change: 'info',
    generate_start: 'success',
    generate_step: 'warning',
    generate_done: 'success',
    error: 'danger'
  }
  return map[type] || 'info'
}

function getLogLabel(type: TaskLogType): string {
  const map: Record<TaskLogType, string> = {
    create: '创建',
    status_change: '状态',
    generate_start: '开始',
    generate_step: '步骤',
    generate_done: '完成',
    error: '错误'
  }
  return map[type] || type
}

// 状态映射
function getStatusType(): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  const status = currentProject.value?.status
  const map = { pending: 'info' as const, generating: 'warning' as const, completed: 'success' as const, failed: 'danger' as const }
  return map[status || 'pending'] || 'info'
}

function getStatusText(): string {
  const status = currentProject.value?.status
  const map = { pending: '待提交', generating: '执行中', completed: '已完成', failed: '失败' }
  return map[status || 'pending'] || '未知'
}

// 初始化
onMounted(async () => {
  const projectId = route.params.id as string
  if (projectId) {
    // 从数据库加载最新项目信息（包括状态、进度、日志）
    await prototypeStore.loadTask(projectId)
    
    // 如果任务正在生成中，启动轮询
    if (currentProject.value?.status === 'generating') {
      startPolling()
    }

    // 如果任务已经完成且没有明确的生成指令，直接跳转到查看页
    if (currentProject.value?.status === 'completed' && !route.query.action) {
      router.push({ name: 'PrototypeView', params: { id: projectId } })
    }
  }

  // 如果路由带有生成动作，自动开始生成
  if (route.query.action === 'generate') {
    startGenerate()
  }
})

// 监听状态变化
watch(() => currentProject.value?.status, (newStatus, oldStatus) => {
  if (newStatus === 'generating' && oldStatus !== 'generating') {
    // 开始生成，启动轮询
    startPolling()
  } else if (newStatus !== 'generating' && oldStatus === 'generating') {
    // 生成结束，停止轮询
    stopPolling()
    
    // 如果是完成状态，提示并跳转
    if (newStatus === 'completed') {
      ElNotification.success({ title: '原型生成完成', message: `共生成 ${genTotalPages.value} 个页面`, duration: 3000 })
      setTimeout(() => {
        if (currentProject.value) {
          router.push({ name: 'PrototypeView', params: { id: currentProject.value.id } })
        }
      }, 1500)
    }
  }
})

/** 启动状态轮询 */
function startPolling() {
  if (pollInterval) return
  pollInterval = setInterval(async () => {
    const projectId = currentProject.value?.id
    if (!projectId) return
    
    // 从数据库刷新项目状态（心跳检测由后端任务管理器负责）
    await prototypeStore.loadTask(projectId)
  }, POLL_INTERVAL_MS)
}

/** 停止状态轮询 */
function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

onUnmounted(() => {
  stopPolling()
  window.electronAPI?.removeAiListeners?.()
})

// 导航
function goBack() {
  router.push({ name: 'PrototypeList' })
}

function goToViewPage() {
  if (currentProject.value) {
    router.push({ name: 'PrototypeView', params: { id: currentProject.value.id } })
  }
}

// 取消生成
async function cancelGenerate() {
  const projectId = currentProject.value?.id
  if (!projectId) return
  
  // 调用后端取消接口
  const result = await prototypeStore.cancelTask(projectId)
  if (result) {
    ElMessage.info('已取消生成')
  } else {
    ElMessage.warning('取消失败')
  }
}

// 开始生成（调用后端任务服务）
async function startGenerate() {
  if (!settingsStore.isConfigured) {
    ElNotification.warning({ title: '请先配置AI', message: '前往“设置”配置API Key', duration: 3000 })
    return
  }

  const projectId = currentProject.value?.id
  if (!projectId) return

  const settings = settingsStore.settings
  
  // 调用后端启动任务
  const result = await prototypeStore.startTask(
    projectId,
    settings.apiKey,
    settings.baseUrl,
    settings.model,
    settings.prompts
  )
  
  if (result.success) {
    ElMessage.success('任务已启动，正在后台生成...')
    // 刷新状态并启动轮询
    await prototypeStore.loadTask(projectId)
  } else {
    ElMessage.error(result.error || '启动任务失败')
  }
}
</script>

<style scoped>
.prototype-generate-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--bg-white);
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.page-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  overflow-y: auto;
}

.state-card {
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  padding: 48px;
  max-width: 680px;
  width: 100%;
  text-align: center;
  box-shadow: var(--shadow-md);
}

.card-icon {
  margin-bottom: 24px;
}

.card-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 24px 0;
}

.requirement-content {
  background: var(--bg);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 32px;
  text-align: left;
}

.requirement-text {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.8;
  margin: 0;
  white-space: pre-wrap;
}

.start-btn, .retry-btn {
  min-width: 200px;
  height: 48px;
  font-size: 16px;
}

/* 生成中状态 */
.gen-steps {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
  margin-bottom: 40px;
}

.gen-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 200px;
  opacity: 0.5;
}

.gen-step.active, .gen-step.done {
  opacity: 1;
}

.step-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--bg);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin-bottom: 12px;
}

.gen-step.active .step-circle {
  border-color: var(--primary);
  color: var(--primary);
  background: #E8F3FF;
}

.gen-step.done .step-circle {
  border-color: var(--success);
  background: var(--success);
  color: #fff;
}

.step-info {
  text-align: center;
}

.step-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.step-desc {
  display: block;
  font-size: 12px;
  color: var(--text-tertiary);
}

.gen-step-line {
  width: 100px;
  height: 2px;
  background: var(--border);
  margin-top: 24px;
}

.gen-step-line.done {
  background: var(--success);
}

.progress-section {
  margin-bottom: 32px;
}

.progress-text {
  display: block;
  margin-top: 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.completed-pages {
  margin-bottom: 24px;
  text-align: left;
}

.completed-label {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.completed-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.error-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  background: #FEF0F0;
  border-radius: var(--radius-md);
  margin-bottom: 24px;
}

.cancel-btn {
  margin-top: 16px;
}

.error-message {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 32px;
}

/* 日志卡片 (内置于 state-card) */
.card-logs {
  margin-top: 32px;
  border-top: 1px solid var(--border-light);
  padding-top: 24px;
  text-align: left;
}

.card-logs-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.log-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.card-logs-content {
  background: var(--bg);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.log-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  color: var(--text-tertiary);
  padding: 32px;
  font-size: 13px;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
}

.log-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  transition: background 0.2s;
}

.log-item:hover {
  background: rgba(0, 0, 0, 0.02);
}

.log-time {
  color: var(--text-tertiary);
  font-family: monospace;
  min-width: 65px;
  padding-top: 2px;
}

.log-message {
  color: var(--text-secondary);
  flex: 1;
  line-height: 1.5;
}

/* 旋转动画 */
.rotating {
  animation: rotating 1s linear infinite;
}

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
