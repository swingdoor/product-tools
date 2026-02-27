<template>
  <div class="prototype-view-page">
    <!-- 顶部导航栏 -->
    <header class="page-header">
      <div class="header-left">
        <el-button text @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回列表
        </el-button>
        <el-divider direction="vertical" />
        <span class="project-title">{{ currentProject?.title || '任务结果' }}</span>
        <el-tag size="small" type="success" effect="plain">已完成</el-tag>
      </div>
      <div class="header-right">
        <el-tooltip content="导出" placement="bottom">
          <el-dropdown @command="handleExport">
            <el-button size="small">
              <el-icon><Download /></el-icon> 导出
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="html">导出全部页面（ZIP）</el-dropdown-item>
                <el-dropdown-item command="single">导出当前页面</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-tooltip>
      </div>
    </header>

    <!-- 主体内容 -->
    <main class="page-content" v-if="currentProject?.status === 'completed' && currentProject?.data">
      <!-- 任务基础信息 -->
      <div class="task-info-bar">
        <span class="info-item">
          <el-icon><Document /></el-icon>
          共 {{ currentProject.data.pages.length }} 个页面
        </span>
        <span class="info-item">
          <el-icon><Clock /></el-icon>
          完成时间：{{ currentProject.updatedAt }}
        </span>
      </div>

      <!-- 两栏布局：页面列表 + 预览区 -->
      <div class="view-layout">
        <!-- 左侧：页面列表 -->
        <aside class="page-panel">
          <div class="panel-title">
            <el-icon><Files /></el-icon>
            <span>页面列表</span>
          </div>
          <el-scrollbar class="page-list">
            <div
              v-for="(page, idx) in currentProject.data.pages"
              :key="page.id"
              class="page-item"
              :class="{ active: currentPageIdx === idx }"
              @click="currentPageIdx = idx"
            >
              <div class="page-thumb">
                <el-icon size="20"><Document /></el-icon>
              </div>
              <div class="page-info">
                <span class="page-name">{{ page.name }}</span>
                <span class="page-desc">{{ page.description }}</span>
              </div>
            </div>
          </el-scrollbar>
        </aside>

        <!-- 右侧：预览区 -->
        <section class="preview-panel">
          <!-- 视图切换 -->
          <div class="preview-toolbar">
            <el-radio-group v-model="viewMode" size="small">
              <el-radio-button value="preview">
                <el-icon><View /></el-icon> 预览
              </el-radio-button>
              <el-radio-button value="prompt">
                <el-icon><ChatDotRound /></el-icon> 提示词
              </el-radio-button>
            </el-radio-group>
            <el-button size="small" @click="openInNewWindow">
              <el-icon><TopRight /></el-icon> 新窗口打开
            </el-button>
          </div>

          <!-- 预览模式 -->
          <div v-if="viewMode === 'preview'" class="preview-iframe-wrap">
            <iframe
              ref="previewIframe"
              :srcdoc="currentHtmlContent"
              class="preview-iframe"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>

          <!-- 提示词模式 -->
          <div v-else class="prompt-panel">
            <div class="prompt-header">
              <span>页面提示词</span>
              <el-button type="primary" size="small" :loading="isRegenerating" @click="regeneratePage">
                <el-icon><Refresh /></el-icon> 重新生成此页面
              </el-button>
            </div>
            <el-input
              v-model="editablePrompt"
              type="textarea"
              :rows="8"
              placeholder="修改提示词后点击重新生成"
            />
          </div>
        </section>
      </div>
    </main>

    <!-- 无效状态 -->
    <main v-else class="page-content invalid-state">
      <el-empty description="该任务尚未完成，请前往生成页">
        <el-button type="primary" @click="goToGeneratePage">进入生成页</el-button>
      </el-empty>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElNotification } from 'element-plus'
import { useProductPrototypeStore } from '@/stores/productPrototype'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const route = useRoute()
const prototypeStore = useProductPrototypeStore()
const settingsStore = useSettingsStore()

// 当前项目
const currentProject = computed(() => prototypeStore.currentProject)

// 视图状态
const currentPageIdx = ref(0)
const viewMode = ref<'preview' | 'prompt'>('preview')
const editablePrompt = ref('')
const isRegenerating = ref(false)
const previewIframe = ref<HTMLIFrameElement | null>(null)

const emptyHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;color:#86909C;">暂无内容</body></html>`

// 当前页面
const currentPage = computed(() => {
  const pages = currentProject.value?.data?.pages
  if (!pages?.length) return null
  return pages[currentPageIdx.value] || null
})

// 当前 HTML 内容
const currentHtmlContent = computed(() => {
  const html = currentPage.value?.htmlContent
  if (!html) return emptyHtml
  if (html.trim().startsWith('<!DOCTYPE') || html.trim().startsWith('<html')) {
    return html
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${html}</body></html>`
})

// 监听页面切换，更新提示词
watch(currentPage, (page) => {
  if (page) {
    editablePrompt.value = page.prompt || ''
  }
}, { immediate: true })

// 初始化
onMounted(() => {
  const projectId = route.params.id as string
  if (projectId && !prototypeStore.currentProject) {
    const project = prototypeStore.getProjectById(projectId)
    if (project) {
      prototypeStore.setCurrentProject(project)
    }
  }
})

// 导航
function goBack() {
  router.push({ name: 'PrototypeList' })
}

function goToGeneratePage() {
  if (currentProject.value) {
    router.push({ name: 'PrototypeGenerate', params: { id: currentProject.value.id } })
  }
}

// 新窗口打开
function openInNewWindow() {
  const html = currentHtmlContent.value
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 导出
async function handleExport(command: string) {
  if (!currentProject.value?.data) return

  if (command === 'single') {
    const html = currentHtmlContent.value
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentPage.value?.name || 'page'}.html`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } else if (command === 'html') {
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const pages = currentProject.value.data.pages
      pages.forEach((page, idx) => {
        zip.file(`${idx + 1}_${page.name}.html`, page.htmlContent)
      })

      // 生成索引页
      const indexHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${currentProject.value.title}</title>
<style>body{font-family:sans-serif;padding:40px;max-width:800px;margin:0 auto}
h1{color:#1D2129}ul{list-style:none;padding:0}li{margin:12px 0}
a{color:#165DFF;text-decoration:none;font-size:16px}a:hover{text-decoration:underline}</style></head>
<body><h1>${currentProject.value.title}</h1><ul>
${pages.map((p, i) => `<li><a href="${i + 1}_${p.name}.html">${p.name}</a><span style="color:#86909C;margin-left:12px">${p.description}</span></li>`).join('')}
</ul></body></html>`
      zip.file('index.html', indexHtml)

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentProject.value.title}.zip`
      a.click()
      URL.revokeObjectURL(url)
      ElMessage.success('导出成功')
    } catch (err) {
      ElMessage.error('导出失败')
    }
  }
}

// 重新生成页面
async function regeneratePage() {
  if (!settingsStore.isConfigured) {
    ElNotification.warning({ title: '请先配置AI', message: '前往"设置"配置API Key', duration: 3000 })
    return
  }

  if (!editablePrompt.value.trim()) {
    ElMessage.warning('请输入提示词')
    return
  }

  isRegenerating.value = true

  try {
    const htmlRaw = await new Promise<string>((resolve, reject) => {
      let result = ''
      window.electronAPI.onAiStreamChunk((data) => { result += data.chunk })
      window.electronAPI.onAiStreamDone(() => resolve(result))
      window.electronAPI.onAiStreamError((data) => reject(new Error(data.error)))
      window.electronAPI.aiCall({
        type: 'prototype-page',
        payload: { customPrompt: editablePrompt.value },
        apiKey: settingsStore.settings.apiKey,
        baseUrl: settingsStore.settings.baseUrl,
        model: settingsStore.settings.model
      })
    })

    let htmlContent = htmlRaw
    const htmlMatch = htmlRaw.match(/```html\s*([\s\S]*?)\s*```/)
    if (htmlMatch) htmlContent = htmlMatch[1]

    // 更新页面内容
    prototypeStore.updatePageHtml(currentPageIdx.value, htmlContent)
    prototypeStore.updatePagePrompt(currentPageIdx.value, editablePrompt.value)

    ElMessage.success('页面重新生成成功')
    viewMode.value = 'preview'
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '重新生成失败')
  } finally {
    isRegenerating.value = false
    window.electronAPI.removeAiListeners()
  }
}
</script>

<style scoped>
.prototype-view-page {
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
  flex-direction: column;
  overflow: hidden;
}

.task-info-bar {
  display: flex;
  gap: 24px;
  padding: 12px 24px;
  background: var(--bg-white);
  border-bottom: 1px solid var(--border);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.view-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧页面列表 */
.page-panel {
  width: 260px;
  background: var(--bg-white);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border);
}

.page-list {
  flex: 1;
}

.page-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-light);
  transition: background 0.2s;
}

.page-item:hover {
  background: var(--bg-hover);
}

.page-item.active {
  background: #E8F3FF;
}

.page-thumb {
  width: 40px;
  height: 40px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.page-info {
  flex: 1;
  min-width: 0;
}

.page-name {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.page-desc {
  display: block;
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 右侧预览区 */
.preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-white);
  border-bottom: 1px solid var(--border);
}

.preview-iframe-wrap {
  flex: 1;
  padding: 16px;
  background: var(--bg);
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: #fff;
}

.prompt-panel {
  flex: 1;
  padding: 16px;
  background: var(--bg-white);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prompt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.invalid-state {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
