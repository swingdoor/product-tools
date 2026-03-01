<template>
  <div class="knowledge-preview-page">
    <!-- 顶部操作栏 -->
    <header class="preview-header">
      <div class="header-left">
        <el-button text @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回列表
        </el-button>
        <el-divider direction="vertical" />
        <span class="doc-title">{{ docInfo?.filename || '加载中...' }}</span>
        <el-tag v-if="docInfo" size="small" :type="getFileTagType(docInfo.type)" effect="plain">
          {{ docInfo.type.toUpperCase() }}
        </el-tag>
      </div>
      <div class="header-right">
        <!-- PDF 新窗口打开按钮 -->
        <el-button v-if="fileExt === '.pdf'" plain @click="openInNewWindow">
          <el-icon><FullScreen /></el-icon>
          新窗口打开
        </el-button>
        <el-button type="primary" plain @click="handleDownload" :disabled="!docInfo">
          <el-icon><Download /></el-icon>
          下载文件
        </el-button>
      </div>
    </header>

    <!-- 搜索匹配高亮提示 -->
    <div v-if="highlightText && fileExt !== '.pdf'" class="highlight-bar">
      <el-icon><InfoFilled /></el-icon>
      <span>语义搜索匹配内容已高亮显示</span>
      <el-button size="small" text @click="scrollToHighlight">定位到匹配位置</el-button>
    </div>

    <!-- 文档内容区 -->
    <main class="preview-body" v-loading="loading">
      <!-- PDF: 使用 iframe 加载原生 Chromium 查看器 -->
      <div v-if="fileExt === '.pdf'" class="preview-content-wrapper pdf-wrapper">
        <iframe
          v-if="pdfSource"
          :src="pdfSource"
          class="pdf-viewer-frame"
          frameborder="0"
        ></iframe>
      </div>

      <!-- Word (docx): 显示 HTML 渲染 -->
      <div v-else-if="fileExt === '.docx' || fileExt === '.doc'" class="preview-content-wrapper">
        <div class="format-hint">
          <el-icon><Notebook /></el-icon>
          Word 文档 — 富文本预览
        </div>
        <div class="html-preview" v-html="renderHtml(previewHtml || previewText)"></div>
      </div>

      <!-- Markdown: 渲染为 Markdown 样式 -->
      <div v-else-if="fileExt === '.md'" class="preview-content-wrapper">
        <div class="format-hint">
          <el-icon><Document /></el-icon>
          Markdown 文档
        </div>
        <div class="md-preview" v-html="renderMarkdown(previewText)"></div>
      </div>

      <!-- TXT: 纯文本 -->
      <div v-else-if="fileExt === '.txt'" class="preview-content-wrapper">
        <div class="format-hint">
          <el-icon><Document /></el-icon>
          纯文本文件
        </div>
        <pre class="txt-preview" v-html="renderText(previewText)"></pre>
      </div>

      <!-- 未知或加载中 -->
      <div v-else-if="!loading" class="preview-content-wrapper">
        <el-empty description="不支持预览此文件格式" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Download, Document, Notebook, InfoFilled, FullScreen } from '@element-plus/icons-vue'
import { knowledgeApi } from '@/api/knowledgeApi'
// @ts-ignore
const isDev = import.meta.env?.DEV || false

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const docInfo = ref<any>(null)
const previewText = ref('')
const previewHtml = ref('')
const fileExt = ref('')

// PDF 相关
const pdfSource = ref<string>('')

// 高亮文本
const highlightText = ref('')

onMounted(async () => {
  const docId = route.params.id as string
  highlightText.value = (route.query.highlight as string) || ''

  try {
    const res = await knowledgeApi.preview(docId)
    if (res.success && res.data) {
      docInfo.value = res.data.doc
      previewText.value = res.data.text || ''
      previewHtml.value = res.data.html || ''
      fileExt.value = res.data.ext || ''

      // PDF: 使用协议 URL (相对路径)，iframe 会自动调用内置渲染器
      if (fileExt.value === '.pdf' && docInfo.value?.path) {
        // #view=FitH 使其水平铺满，适合阅读体验
        pdfSource.value = `knowledge-file://local/${docInfo.value.path}#view=FitH`
      }

      // 非 PDF: 高亮定位
      if (highlightText.value && fileExt.value !== '.pdf') {
        await nextTick()
        setTimeout(() => scrollToHighlight(), 500)
      }
    } else {
      ElMessage.error(res.error || '加载文档失败')
    }
  } catch (e: any) {
    ElMessage.error('加载出错: ' + (e.message || String(e)))
  } finally {
    loading.value = false
  }
})

function goBack() {
  router.push({ name: 'KnowledgeBase' })
}

function handleDownload() {
  if (docInfo.value?.fullPath && window.electronAPI) {
    window.electronAPI.openFile(docInfo.value.fullPath)
  }
}

// 新窗口打开 PDF（使用 Chromium 内置完整 PDF 查看器）
async function openInNewWindow() {
  if (docInfo.value?.fullPath) {
    await knowledgeApi.openPdfWindow(docInfo.value.fullPath)
  }
}

function getFileTagType(type: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  switch (type?.toLowerCase()) {
    case 'pdf': return 'danger'
    case 'doc': case 'docx': return 'primary'
    case 'md': return 'warning'
    case 'txt': return 'info'
    default: return 'info'
  }
}

function renderText(text: string): string {
  if (!text) return ''
  let escaped = escapeHtml(text)
  if (highlightText.value) {
    const escapedHL = escapeHtml(highlightText.value)
    const searchSnippet = escapedHL.substring(0, 50)
    if (searchSnippet) {
      const regex = new RegExp(escapeRegex(searchSnippet), 'gi')
      escaped = escaped.replace(regex, (match) => `<mark class="search-highlight">${match}</mark>`)
    }
  }
  return escaped
}

function renderHtml(html: string): string {
  if (!html) return ''
  if (highlightText.value) {
    const searchSnippet = highlightText.value.substring(0, 50)
    if (searchSnippet) {
      const regex = new RegExp(escapeRegex(escapeHtml(searchSnippet)), 'gi')
      html = html.replace(regex, (match) => `<mark class="search-highlight">${match}</mark>`)
    }
  }
  return html
}

function renderMarkdown(text: string): string {
  if (!text) return ''
  let html = escapeHtml(text)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')

  if (highlightText.value) {
    const searchSnippet = escapeHtml(highlightText.value.substring(0, 50))
    if (searchSnippet) {
      const regex = new RegExp(escapeRegex(searchSnippet), 'gi')
      html = html.replace(regex, (match) => `<mark class="search-highlight">${match}</mark>`)
    }
  }
  return html
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function scrollToHighlight() {
  const mark = document.querySelector('.knowledge-preview-page .search-highlight')
  if (mark) {
    mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}
</script>

<style scoped>
.knowledge-preview-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-layout, #f5f7fa);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--bg-white);
  border-bottom: 1px solid var(--border-split);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.doc-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 高亮提示栏 */
.highlight-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 24px;
  background: #FFF7E6;
  border-bottom: 1px solid #FFD591;
  font-size: 13px;
  color: #AD6800;
  flex-shrink: 0;
}

/* 内容区 */
.preview-body {
  flex: 1;
  overflow: auto;
  padding: 24px;
}

.preview-content-wrapper {
  max-width: 900px;
  margin: 0 auto;
  background: var(--bg-white);
  border-radius: 10px;
  border: 1px solid var(--border-split);
  overflow: hidden;
}

.preview-content-wrapper.pdf-wrapper {
  max-width: 1000px; /* 限制宽度，使其在大屏下更美观 */
  margin: 0 auto;
  height: calc(100vh - 140px);
  border: none;
  background: white;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); /* 添加微妙阴影 */
  border-radius: 12px;
  overflow: hidden;
}

.pdf-viewer-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

/* Word HTML 预览 */
.html-preview {
  padding: 24px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-primary);
}
.html-preview :deep(h1) { font-size: 24px; font-weight: 700; margin: 16px 0 8px; }
.html-preview :deep(h2) { font-size: 20px; font-weight: 600; margin: 14px 0 6px; }
.html-preview :deep(h3) { font-size: 17px; font-weight: 600; margin: 12px 0 4px; }
.html-preview :deep(p) { margin: 6px 0; }
.html-preview :deep(ul), .html-preview :deep(ol) { padding-left: 20px; }
.html-preview :deep(table) { border-collapse: collapse; width: 100%; margin: 12px 0; }
.html-preview :deep(td), .html-preview :deep(th) { border: 1px solid #ddd; padding: 6px 10px; }

/* Markdown 预览 */
.md-preview {
  padding: 24px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-primary);
}
.md-preview :deep(h1) { font-size: 24px; font-weight: 700; margin: 16px 0 8px; }
.md-preview :deep(h2) { font-size: 20px; font-weight: 600; margin: 14px 0 6px; }
.md-preview :deep(h3) { font-size: 17px; font-weight: 600; margin: 12px 0 4px; }
.md-preview :deep(code) {
  background: #F5F5F5;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', monospace;
  font-size: 13px;
}

/* TXT 纯文本预览 */
.txt-preview {
  padding: 24px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-family: inherit;
}

/* 搜索高亮 */
:deep(.search-highlight) {
  background: #FFEB3B;
  padding: 2px 1px;
  border-radius: 2px;
  color: #333;
}
</style>
