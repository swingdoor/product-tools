<template>
  <div class="ai-loading-wrap">
    <!-- 生成中状态 -->
    <div v-if="status === 'loading'" class="loading-box">
      <div class="loading-icon">
        <div class="spinner"></div>
      </div>
      <div class="loading-text">
        <p class="loading-title">{{ title || 'AI 正在生成中...' }}</p>
        <p class="loading-sub">{{ streamText || hint || '这可能需要约30-60秒，请耐心等待' }}</p>
      </div>
      <div class="ai-loading-dots">
        <span></span><span></span><span></span>
      </div>
    </div>

    <!-- 流式输出预览 -->
    <div v-if="status === 'streaming' && streamText" class="stream-preview">
      <div class="stream-header">
        <div class="ai-loading-dots"><span></span><span></span><span></span></div>
        <span class="stream-label">正在生成...</span>
      </div>
      <div class="stream-content markdown-body" v-html="streamHtml" ref="streamRef" />
    </div>

    <!-- 错误状态 -->
    <div v-if="status === 'error'" class="error-box">
      <el-icon size="40" color="#F53F3F"><CircleCloseFilled /></el-icon>
      <p class="error-title">生成失败</p>
      <p class="error-msg">{{ errorMessage || '请求失败，请检查网络和API配置后重试' }}</p>
      <div class="error-actions">
        <el-button type="primary" @click="$emit('retry')">
          <el-icon><RefreshRight /></el-icon>重新生成
        </el-button>
        <el-button @click="$emit('cancel')">取消</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { marked } from 'marked'

interface Props {
  status: 'idle' | 'loading' | 'streaming' | 'error' | 'done'
  title?: string
  hint?: string
  streamText?: string
  errorMessage?: string
}

const props = defineProps<Props>()
defineEmits<{ retry: []; cancel: [] }>()

const streamRef = ref<HTMLElement | null>(null)

const streamHtml = computed(() => {
  if (!props.streamText) return ''
  return marked(props.streamText) as string
})

// 流式输出时自动滚动到底部
watch(() => props.streamText, () => {
  nextTick(() => {
    if (streamRef.value) {
      streamRef.value.scrollTop = streamRef.value.scrollHeight
    }
  })
})
</script>

<style scoped>
.ai-loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}

/* ── 加载中 ─────────────────────────────────────────────── */
.loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px 32px;
}

.loading-icon {
  width: 64px;
  height: 64px;
  background: var(--primary-lighter);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--primary-lighter);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  text-align: center;
}
.loading-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.loading-sub {
  font-size: 13px;
  color: var(--text-tertiary);
  max-width: 300px;
  line-height: 1.6;
}

/* ── 流式预览 ────────────────────────────────────────────── */
.stream-preview {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.stream-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--primary-lighter);
  border-bottom: 1px solid var(--border);
}

.stream-label {
  font-size: 13px;
  color: var(--primary);
  font-weight: 500;
}

.stream-content {
  max-height: 400px;
  overflow-y: auto;
  padding: 16px 20px;
  background: var(--bg-white);
}

/* ── 错误状态 ─────────────────────────────────────────────── */
.error-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 32px;
}

.error-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--danger);
}

.error-msg {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  max-width: 360px;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}
</style>
