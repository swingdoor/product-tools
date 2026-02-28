<template>
  <div class="markdown-renderer">
    <!-- 工具栏 -->
    <div v-if="showToolbar" class="md-toolbar">
      <div class="md-search" v-if="searchable">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索关键词..."
          size="small"
          clearable
          :prefix-icon="Search"
          style="width: 220px"
          @input="highlightSearch"
          @clear="clearSearch"
        />
        <span v-if="searchKeyword && matchCount > 0" class="search-count">
          {{ currentMatch }}/{{ matchCount }}
        </span>
        <el-button v-if="searchKeyword" size="small" @click="prevMatch" :disabled="matchCount === 0">
          <el-icon><ArrowUp /></el-icon>
        </el-button>
        <el-button v-if="searchKeyword" size="small" @click="nextMatch" :disabled="matchCount === 0">
          <el-icon><ArrowDown /></el-icon>
        </el-button>
      </div>
      <div class="md-actions">
        <el-tooltip content="复制全文" placement="top">
          <el-button size="small" @click="copyContent">
            <el-icon><CopyDocument /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip v-if="exportable" content="导出" placement="top">
          <el-dropdown @command="handleExport">
            <el-button size="small">
              <el-icon><Download /></el-icon>
              <span style="margin-left:4px">导出</span>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="md">导出 Markdown</el-dropdown-item>
                <el-dropdown-item command="pdf">导出 PDF</el-dropdown-item>
                <el-dropdown-item command="txt">导出 TXT</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-tooltip>
        <el-tooltip v-if="printable" content="打印" placement="top">
          <el-button size="small" @click="handlePrint">
            <el-icon><Printer /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- Markdown 渲染内容 -->
    <div
      ref="contentRef"
      class="markdown-body md-content"
      v-html="renderedHtml"
      @click="handleContentClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { marked } from 'marked'
import { ElMessage } from 'element-plus'
import { Search, CopyDocument, Download, Printer, ArrowUp, ArrowDown } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'

interface Props {
  content: string
  showToolbar?: boolean
  searchable?: boolean
  exportable?: boolean
  printable?: boolean
  filename?: string
}

const props = withDefaults(defineProps<Props>(), {
  showToolbar: true,
  searchable: true,
  exportable: true,
  printable: true,
  filename: 'report'
})

const settingsStore = useSettingsStore()
const contentRef = ref<HTMLElement | null>(null)
const searchKeyword = ref('')
const matchCount = ref(0)
const currentMatch = ref(0)

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
})

const renderedHtml = computed(() => {
  if (!props.content) return '<p style="color:#86909C;text-align:center;padding:40px 0">暂无内容</p>'
  return marked(props.content) as string
})

watch(renderedHtml, () => {
  nextTick(() => {
    if (searchKeyword.value) highlightSearch()
  })
})

// ── 搜索高亮 ──────────────────────────────────────────────
function highlightSearch() {
  if (!contentRef.value) return
  const keyword = searchKeyword.value.trim()
  if (!keyword) {
    clearSearch()
    return
  }
  // 先清除之前的高亮，重新渲染 HTML
  const baseHtml = marked(props.content) as string
  const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi')
  const highlighted = baseHtml.replace(regex, '<mark class="search-highlight">$1</mark>')
  if (contentRef.value) {
    contentRef.value.innerHTML = highlighted
  }
  const marks = contentRef.value?.querySelectorAll('.search-highlight') || []
  matchCount.value = marks.length
  currentMatch.value = matchCount.value > 0 ? 1 : 0
  scrollToMatch(0)
}

function clearSearch() {
  if (contentRef.value) {
    contentRef.value.innerHTML = renderedHtml.value
  }
  matchCount.value = 0
  currentMatch.value = 0
}

function scrollToMatch(index: number) {
  const marks = contentRef.value?.querySelectorAll('.search-highlight') || []
  if (marks[index]) {
    marks[index].scrollIntoView({ behavior: 'smooth', block: 'center' })
    // 当前条目高亮
    marks.forEach((m, i) => {
      ;(m as HTMLElement).style.outline = i === index ? '2px solid #165DFF' : 'none'
    })
  }
}

function nextMatch() {
  if (matchCount.value === 0) return
  currentMatch.value = (currentMatch.value % matchCount.value) + 1
  scrollToMatch(currentMatch.value - 1)
}

function prevMatch() {
  if (matchCount.value === 0) return
  currentMatch.value = currentMatch.value <= 1 ? matchCount.value : currentMatch.value - 1
  scrollToMatch(currentMatch.value - 1)
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── 复制 ──────────────────────────────────────────────────
async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.content)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

// ── 导出 ──────────────────────────────────────────────────
async function handleExport(format: string) {
  if (!window.electronAPI) {
    ElMessage.warning('导出功能仅在桌面端可用')
    return
  }

  const filters: Record<string, { name: string; extensions: string[] }[]> = {
    md: [{ name: 'Markdown', extensions: ['md'] }],
    pdf: [{ name: 'PDF', extensions: ['pdf'] }],
    txt: [{ name: 'Text', extensions: ['txt'] }]
  }

  const result = await window.electronAPI.showSaveDialog({
    title: '导出报告',
    defaultPath: props.filename,
    filters: filters[format] || filters.md
  })

  if (result.canceled || !result.filePath) return

  try {
    let content = props.content
    if (format === 'pdf') {
      // PDF 导出：将 HTML 内容通过打印方式生成（简化实现）
      ElMessage.info('PDF导出请使用打印功能')
      return
    }
    const writeResult = await window.electronAPI.writeFile(result.filePath, content)
    if (writeResult.success) {
      ElMessage.success('导出成功')
      await window.electronAPI.openFile(result.filePath)
    } else {
      ElMessage.error(`导出失败: ${writeResult.error}`)
    }
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

// ── 打印 ──────────────────────────────────────────────────
function handlePrint() {
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${props.filename}</title>
      <style>
        body { font-family: -apple-system, 'PingFang SC', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1,h2,h3 { margin-top: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th,td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background: #f0f4ff; }
        pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
        code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
        blockquote { border-left: 4px solid #165DFF; padding-left: 16px; color: #666; }
      </style>
    </head>
    <body>${renderedHtml.value}</body>
    </html>
  `
  const w = window.open('', '_blank')
  if (w) {
    w.document.write(printContent)
    w.document.close()
    w.print()
    w.close()
  }
}

// ── 链接点击拦截 ──────────────────────────────────────────
function handleContentClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const link = target.closest('a')
  if (link && link.href) {
    const url = link.href
    // 如果是外部链接（http 开头且非 file 开头）
    if (url.startsWith('http')) {
      event.preventDefault()
      if (window.electronAPI) {
        window.electronAPI.openExternal(url)
      } else {
        window.open(url, '_blank')
      }
    }
  }
}
</script>

<style scoped>
.markdown-renderer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.md-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #FAFAFA;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.md-search {
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-count {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.md-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.md-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}
</style>
