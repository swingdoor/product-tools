<template>
  <div class="system-log-container">
    <div class="header-actions">
      <el-button type="primary" :icon="Refresh" @click="fetchLogs" :loading="loading">刷新日志</el-button>
      <el-input
        v-model="searchKeyword"
        placeholder="搜索关键词 (消息、详情、任务ID...)"
        style="width: 300px"
        clearable
        :prefix-icon="Search"
      />
      <el-tag type="info">显示最近 {{ filteredLogs.length }} 条匹配日志 (总量 200)</el-tag>
    </div>

    <div class="log-table-wrapper">
      <el-table :data="filteredLogs" stripe style="width: 100%" height="100%">
        <el-table-column prop="timestamp" label="时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="180">
          <template #default="{ row }">
            <el-tag :type="getLogTag(row.type)" size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="消息" min-width="200" show-overflow-tooltip />
        <el-table-column prop="detail" label="详情" width="250" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="detail-text">{{ row.detail || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="taskId" label="任务ID" width="150" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

interface LogItem {
  id: string
  taskId: string
  type: string
  message: string
  detail?: string
  timestamp: string
}

const logs = ref<LogItem[]>([])
const loading = ref(false)
const searchKeyword = ref('')

const filteredLogs = computed(() => {
  if (!searchKeyword.value) return logs.value
  const kw = searchKeyword.value.toLowerCase()
  return logs.value.filter(log => 
    log.message?.toLowerCase().includes(kw) ||
    log.detail?.toLowerCase().includes(kw) ||
    log.type?.toLowerCase().includes(kw) ||
    log.taskId?.toLowerCase().includes(kw)
  )
})

const fetchLogs = async () => {
  loading.value = true
  try {
    const res = await window.electronAPI.dbGetAllLogs()
    if (res.success && res.data) {
      // 数据库端已经做了2000条限制，前端再取最新的200条
      logs.value = res.data.slice(0, 200)
    }
  } catch (err) {
    console.error('Failed to fetch logs:', err)
  } finally {
    loading.value = false
  }
}

const formatDate = (ts: string) => {
  return dayjs(ts).format('YYYY-MM-DD HH:mm:ss')
}

const getLogTag = (type: string) => {
  const typeLower = type.toLowerCase()
  if (typeLower.includes('error') || typeLower.includes('fail')) return 'danger'
  if (typeLower.includes('warn')) return 'warning'
  if (typeLower.includes('start') || typeLower.includes('success')) return 'success'
  return 'info'
}

onMounted(() => {
  fetchLogs()
})
</script>

<style scoped>
.system-log-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  background: #fff;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.log-table-wrapper {
  flex: 1;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
}

.detail-text {
  font-family: monospace;
  font-size: 12px;
  color: #666;
}
</style>
