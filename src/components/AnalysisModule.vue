<template>
  <div class="analysis-module" :class="{ collapsed: isCollapsed }">
    <!-- 模块标题栏 -->
    <div class="module-header" @click="toggleCollapse">
      <div class="module-title-area">
        <el-icon class="module-icon" :style="{ color: iconColor }">
          <component :is="icon" />
        </el-icon>
        <h3 class="module-title">{{ title }}</h3>
        <el-tag v-if="badge" size="small" :type="badgeType" effect="plain">{{ badge }}</el-tag>
      </div>
      <div class="module-actions" @click.stop>
        <el-tooltip content="复制" placement="top">
          <el-button size="small" circle plain @click="copyModule">
            <el-icon><CopyDocument /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip :content="isEditing ? '保存编辑' : '编辑'" placement="top">
          <el-button size="small" circle plain :type="isEditing ? 'primary' : ''" @click="toggleEdit">
            <el-icon><component :is="isEditing ? 'Check' : 'EditPen'" /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="折叠/展开" placement="top">
          <el-button size="small" circle plain @click.stop="toggleCollapse">
            <el-icon :class="{ 'rotate-180': !isCollapsed }"><ArrowDown /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 模块内容 -->
    <transition name="slide-down">
      <div v-show="!isCollapsed" class="module-body">
        <!-- 编辑模式 -->
        <div v-if="isEditing" class="edit-mode">
          <el-input
            v-model="editContent"
            type="textarea"
            :rows="12"
            resize="none"
            placeholder="编辑内容..."
          />
          <div class="edit-actions">
            <el-button type="primary" size="small" @click="saveEdit">保存</el-button>
            <el-button size="small" @click="cancelEdit">取消</el-button>
            <el-button size="small" type="warning" @click="$emit('reanalyze', title, editContent)">
              <el-icon><MagicStick /></el-icon> 基于修改重新分析
            </el-button>
          </div>
        </div>

        <!-- 查看模式 -->
        <div v-else class="view-mode markdown-body" v-html="renderedContent" />
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import { ElMessage } from 'element-plus'

interface Props {
  title: string
  content: string
  icon?: string
  iconColor?: string
  badge?: string
  badgeType?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  defaultCollapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  icon: 'Document',
  iconColor: '#165DFF',
  badgeType: 'info',
  defaultCollapsed: false
})

const emit = defineEmits<{
  'update:content': [value: string]
  reanalyze: [moduleTitle: string, content: string]
}>()

const isCollapsed = ref(props.defaultCollapsed)
const isEditing = ref(false)
const editContent = ref(props.content)

const renderedContent = computed(() => {
  if (!props.content) return '<p style="color:#86909C;padding:8px 0">暂无内容</p>'
  return marked(props.content) as string
})

watch(() => props.content, (val) => {
  editContent.value = val
})

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function toggleEdit() {
  if (isEditing.value) {
    saveEdit()
  } else {
    editContent.value = props.content
    isEditing.value = true
  }
}

function saveEdit() {
  emit('update:content', editContent.value)
  isEditing.value = false
  ElMessage.success('已保存修改')
}

function cancelEdit() {
  editContent.value = props.content
  isEditing.value = false
}

async function copyModule() {
  try {
    await navigator.clipboard.writeText(props.content)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}
</script>

<style scoped>
.analysis-module {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-white);
  transition: box-shadow 0.15s;
}
.analysis-module:hover { box-shadow: var(--shadow-sm); }

.module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  background: #FAFAFA;
  border-bottom: 1px solid var(--border);
  user-select: text;
}
.collapsed .module-header { border-bottom: none; }

.module-title-area {
  display: flex;
  align-items: center;
  gap: 10px;
}
.module-icon { flex-shrink: 0; }
.module-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }

.module-actions {
  display: flex;
  gap: 6px;
}

.rotate-180 {
  transform: rotate(180deg);
}

.module-body {
  padding: 16px 20px;
}

.view-mode { user-select: text; }

.edit-mode {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.edit-actions {
  display: flex;
  gap: 8px;
}

/* 折叠动画 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  padding: 0;
}
.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 2000px;
  opacity: 1;
}
</style>
