<template>
  <div class="settings-page">
    <el-scrollbar>
      <div class="settings-inner">
        
        <!-- 选项卡切换 -->
        <el-tabs v-model="activeTab" class="settings-tabs">
          <!-- 1. API 配置 -->
          <el-tab-pane label="API 配置" name="api">
            <el-card shadow="never" class="settings-card">
              <template #header>
                <div class="card-header">
                  <el-icon color="#165DFF"><Setting /></el-icon>
                  <span>AI 接口配置</span>
                  <el-tag v-if="settingsStore.isConfigured" type="success" size="small">已配置</el-tag>
                  <el-tag v-else type="warning" size="small">未配置</el-tag>
                </div>
              </template>

              <el-form :model="form" label-position="top" class="settings-form">
                <el-form-item label="API Key" required>
                  <el-input
                    v-model="form.apiKey"
                    type="password"
                    show-password
                    placeholder="sk-..."
                    clearable
                  />
                  <div class="field-hint">您的 AI 服务 API Key，安全存储在本地</div>
                </el-form-item>

                <el-form-item label="接口地址 (Base URL)" required>
                  <el-input
                    v-model="form.baseUrl"
                    placeholder="https://api.deepseek.com/v1"
                    clearable
                  />
                  <div class="field-hint">OpenAI 兼容接口地址，支持 DeepSeek、OpenAI 等</div>
                </el-form-item>

                <el-form-item label="模型">
                  <el-select v-model="form.model" filterable allow-create style="width:100%">
                    <el-option-group label="DeepSeek">
                      <el-option label="deepseek-reasoner (R1, 推荐)" value="deepseek-reasoner" />
                      <el-option label="deepseek-chat (V3)" value="deepseek-chat" />
                    </el-option-group>
                    <el-option-group label="OpenAI">
                      <el-option label="gpt-4o" value="gpt-4o" />
                      <el-option label="o3-mini" value="o3-mini" />
                    </el-option-group>
                  </el-select>
                </el-form-item>

                <div class="form-actions">
                  <el-button type="primary" size="large" @click="saveSettings" :loading="saving">
                    <el-icon><Check /></el-icon> 保存配置
                  </el-button>
                  <el-button size="large" @click="testConnection" :loading="testing">
                    <el-icon><Connection /></el-icon> 测试连接
                  </el-button>
                </div>
              </el-form>

              <el-alert
                v-if="testResult"
                :title="testResult.message"
                :type="testResult.success ? 'success' : 'error'"
                :closable="false"
                show-icon
                style="margin-top:16px"
              />
            </el-card>

            <el-card shadow="never" class="settings-card" style="margin-top:20px">
              <template #header>
                <div class="card-header">
                  <el-icon color="#86909C"><Star /></el-icon>
                  <span>快捷配置模板</span>
                </div>
              </template>
              <div class="templates">
                <div v-for="tpl in templates" :key="tpl.name" class="template-item" @click="applyTemplate(tpl)">
                  <div class="template-icon" :style="{ background: tpl.color + '20', color: tpl.color }">{{ tpl.icon }}</div>
                  <div class="template-info">
                    <p class="template-name">{{ tpl.name }}</p>
                    <p class="template-url">{{ tpl.baseUrl }}</p>
                  </div>
                  <el-button size="small" type="primary" plain>使用</el-button>
                </div>
              </div>
            </el-card>
          </el-tab-pane>

          <!-- 2. 联网搜索配置 -->
          <el-tab-pane label="联网搜索配置" name="search">
            <el-card shadow="never" class="settings-card">
              <template #header>
                <div class="card-header">
                  <el-icon color="#722ED1"><Search /></el-icon>
                  <span>联网搜索配置 (Deep Research)</span>
                </div>
              </template>
              <el-form :model="form" label-position="top" class="settings-form">
                <el-form-item>
                  <el-switch
                    v-model="form.searchConfig.enabled"
                    active-text="开启联网搜索"
                    inactive-text="关闭"
                    size="large"
                  />
                  <div class="field-hint">开启后，在创建市场洞察报告时勾选「联网搜索」，系统将从网页获取实时信息。</div>
                </el-form-item>

                <el-form-item v-if="form.searchConfig.enabled" label="数据源">
                  <div class="source-grid">
                    <el-checkbox-group v-model="form.searchConfig.sources">
                      <div class="source-item">
                        <el-checkbox value="bocha_api" disabled checked>
                          <div class="source-label">
                            <span class="source-name">博查 Web Search API</span>
                            <span class="source-desc">专为 AI Agent 和 RAG 设计的国内合规搜索 API</span>
                          </div>
                        </el-checkbox>
                      </div>
                    </el-checkbox-group>
                  </div>
                </el-form-item>

                <el-form-item v-if="form.searchConfig.enabled" label="博查 API Key" required>
                  <el-input
                    v-model="form.searchConfig.bochaApiKey"
                    type="password"
                    show-password
                    placeholder="sk-..."
                    clearable
                  />
                  <div class="field-hint">请前往 <a href="https://open.bochaai.com" target="_blank">open.bochaai.com</a> 申请获取 API Key</div>
                </el-form-item>

                <div class="form-actions">
                  <el-button type="primary" size="large" @click="saveSettings" :loading="saving">
                    <el-icon><Check /></el-icon> 保存搜索配置
                  </el-button>
                </div>
              </el-form>
            </el-card>
          </el-tab-pane>
          <el-tab-pane label="提示词配置" name="prompts">
            <el-card shadow="never" class="settings-card">
              <template #header>
                <div class="card-header">
                  <el-icon color="#FF7D00"><ChatLineSquare /></el-icon>
                  <span>系统提示词 (System Prompts)</span>
                  <el-button type="primary" link @click="resetPrompts">
                    <el-icon><Refresh /></el-icon> 恢复默认
                  </el-button>
                </div>
              </template>
              
              <div class="prompts-list">
                <div class="prompt-item" v-for="(label, key) in promptLabels" :key="key">
                  <div class="prompt-header">
                    <span class="prompt-title">{{ label }}</span>
                    <span class="prompt-key">{{ key }}</span>
                  </div>
                  <el-input
                    v-model="form.prompts[key]"
                    type="textarea"
                    :rows="4"
                    placeholder="输入系统提示词..."
                  />
                </div>
              </div>

              <div class="form-actions" style="margin-top:20px">
                <el-button type="primary" size="large" @click="saveSettings" :loading="saving">
                  <el-icon><Check /></el-icon> 保存提示词
                </el-button>
              </div>
            </el-card>
          </el-tab-pane>

          <el-tab-pane label="数据管理" name="data">
            <el-card shadow="never" class="settings-card">
              <template #header>
                <div class="card-header">
                  <el-icon color="#F53F3F"><DeleteFilled /></el-icon>
                  <span>数据管理</span>
                </div>
              </template>
              <div class="data-actions">
                <div class="data-item">
                  <div class="data-info">
                    <p class="data-title">清除市场洞察历史</p>
                    <p class="data-desc">删除所有历史生成的市场洞察报告（当前 {{ marketStore.tasks.length }} 条）</p>
                  </div>
                  <el-button type="danger" plain size="small" @click="handleClearMarket">清除</el-button>
                </div>
                <el-divider />
                <div class="data-item">
                  <div class="data-info">
                    <p class="data-title">清除需求分析历史</p>
                    <p class="data-desc">删除所有保存的需求分析任务（当前 {{ analysisStore.tasks.length }} 条）</p>
                  </div>
                  <el-button type="danger" plain size="small" @click="handleClearAnalysis">清除</el-button>
                </div>
                <el-divider />
                <div class="data-item">
                  <div class="data-info">
                    <p class="data-title">清除产品原型历史</p>
                    <p class="data-desc">删除所有保存的产品原型项目（当前 {{ prototypeStore.tasks.length }} 条）</p>
                  </div>
                  <el-button type="danger" plain size="small" @click="handleClearPrototype">清除</el-button>
                </div>
                <el-divider />
                <div class="data-item">
                  <div class="data-info">
                    <p class="data-title">清除设计文档历史</p>
                    <p class="data-desc">删除所有生成的设计文档（当前 {{ designDocStore.tasks.length }} 条）</p>
                  </div>
                  <el-button type="danger" plain size="small" @click="handleClearDesign">清除</el-button>
                </div>

                <el-divider />
                <div class="config-path-section">
                  <div class="config-path-info">
                    <p class="data-title">本地数据库路径</p>
                    <div class="path-display">
                      <code>{{ dbPath || '正在加载...' }}</code>
                    </div>
                  </div>
                  <el-button type="primary" plain size="small" @click="handleOpenFolder">打开文件夹</el-button>
                </div>
              </div>
            </el-card>
          </el-tab-pane>

          <!-- 5. 配置文件 -->
          <el-tab-pane label="配置文件" name="config-file">
            <el-card shadow="never" class="settings-card">
              <template #header>
                <div class="card-header">
                  <el-icon color="#FF7D00"><Document /></el-icon>
                  <span>config.json (系统配置文件)</span>
                  <el-button type="primary" link @click="handleOpenConfigFolder">
                    <el-icon><FolderOpened /></el-icon> 打开目录
                  </el-button>
                </div>
              </template>
              <div class="config-json-viewer">
                <div class="json-header">
                  <span class="json-path">{{ realConfigPath }}</span>
                  <el-button type="primary" size="small" @click="refreshConfigJson">刷新</el-button>
                </div>
                <div class="json-content">
                  <pre><code>{{ configJsonStr }}</code></pre>
                </div>
                <div class="field-hint" style="margin-top:12px">
                  提示：以上为系统的持久化配置文件。您在其他标签页保存的修改会实时同步到此文件中。
                </div>
              </div>
            </el-card>
          </el-tab-pane>
        </el-tabs>

      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import { useMarketInsightStore } from '@/stores/marketInsight'
import { useProductAnalysisStore } from '@/stores/productAnalysis'
import { useProductPrototypeStore } from '@/stores/productPrototype'
import { useDesignDocStore } from '@/stores/designDoc'

const settingsStore = useSettingsStore()
const marketStore = useMarketInsightStore()
const analysisStore = useProductAnalysisStore()
const prototypeStore = useProductPrototypeStore()
const designDocStore = useDesignDocStore()

const activeTab = ref('api')
const form = reactive({
  ...settingsStore.settings,
  searchConfig: {
    enabled: settingsStore.settings.searchConfig?.enabled ?? false,
    sources: ['bocha_api'], // 强制使用 bocha_api
    bochaApiKey: settingsStore.settings.searchConfig?.bochaApiKey || ''
  }
})
const saving = ref(false)
const testing = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)
const dbPath = ref('')
const realConfigPath = ref('')
const configJsonStr = ref('')

const searchSources = [
  { id: 'bocha_api', label: '博查 Web Search API', desc: '专为 AI Agent 和 RAG 设计的国内合规搜索 API' }
]

const promptLabels: Record<string, string> = {
  'market-insight': '市场洞察 (Market Insight)',
  'product-analysis': '需求分析 (Product Analysis)',
  'prototype-plan': '原型页面规划 (Prototype Plan)',
  'prototype-page': '单页原型设计 (Prototype Page)',
  'design-doc': '设计文档 (Design Document)'
}

const templates = [
  { name: 'DeepSeek (推荐)', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-reasoner', icon: '🔮', color: '#165DFF' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', icon: '🤖', color: '#10A37F' },
  { name: 'Moonshot (月之暗面)', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-128k', icon: '🌙', color: '#722ED1' },
  { name: 'OpenAI 兼容代理', baseUrl: 'https://your-proxy.com/v1', model: 'deepseek-chat', icon: '🔄', color: '#FF7D00' }
]

function applyTemplate(tpl: typeof templates[0]) {
  form.baseUrl = tpl.baseUrl
  form.model = tpl.model
  ElMessage.success(`已应用 ${tpl.name} 模板，请填写 API Key 后保存`)
}

async function saveSettings() {
  saving.value = true
  // 模拟保存延迟
  await new Promise(resolve => setTimeout(resolve, 300))
  
  await settingsStore.save({ ...form, searchConfig: { ...form.searchConfig, sources: form.searchConfig.sources as any } })
  await refreshConfigJson() // 保存后刷新 JSON 预览
  
  saving.value = false
  testResult.value = null
  ElMessage.success('配置已保存并同步至 config.json')
}

async function testConnection() {
  if (!form.apiKey.trim() || !form.baseUrl.trim()) {
    ElMessage.warning('请先填写 API Key 和接口地址')
    return
  }
  testing.value = true
  testResult.value = null
  try {
    const response = await fetch(`${form.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${form.apiKey}` }
    })
    if (response.ok) {
      testResult.value = { success: true, message: '连接成功！接口配置正确。' }
    } else {
      testResult.value = { success: false, message: `连接失败：HTTP ${response.status} - ${response.statusText}` }
    }
  } catch (err) {
    testResult.value = { success: false, message: `连接失败：${err instanceof Error ? err.message : '网络错误'}` }
  } finally {
    testing.value = false
  }
}

function clearMarketHistory() {
  localStorage.removeItem('pt_market_reports')
  marketStore.tasks.splice(0)
  ElMessage.success('市场洞察历史已清除')
}

async function clearAnalysisDrafts() {
  // 清除数据库中的分析任务
  localStorage.removeItem('pt_analysis_tasks')
  await analysisStore.loadTasks() // 先加载数据
  const taskIds = analysisStore.tasks.map(t => t.id)
  for (const id of taskIds) {
    await analysisStore.deleteTask(id)
  }
  ElMessage.success('需求分析历史已清除')
}

function clearPrototypeHistory() {
  localStorage.removeItem('pt_prototypes')
  prototypeStore.tasks.splice(0)
  ElMessage.success('产品原型历史已清除')
}

// 数据清除处理函数
async function handleClearMarket() {
  try {
    await ElMessageBox.confirm('确定要清除所有市场洞察报告吗？\n\n此操作不可恢复！', '警告', {
      confirmButtonText: '确定清除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const result = await window.electronAPI.dataClearMarket()
    if (result.success) {
      await marketStore.loadTasks()
      ElMessage.success('市场洞察历史已清除')
    } else {
      ElMessage.error(result.error || '清除失败')
    }
  } catch {
    // 用户取消
  }
}

async function handleClearAnalysis() {
  try {
    await ElMessageBox.confirm('确定要清除所有需求分析任务吗？\n\n此操作不可恢复！', '警告', {
      confirmButtonText: '确定清除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const result = await window.electronAPI.dataClearAnalysis()
    if (result.success) {
      await analysisStore.loadTasks()
      ElMessage.success('需求分析历史已清除')
    } else {
      ElMessage.error(result.error || '清除失败')
    }
  } catch {
    // 用户取消
  }
}

async function handleClearPrototype() {
  try {
    await ElMessageBox.confirm('确定要清除所有产品原型项目吗？\n\n此操作不可恢复！', '警告', {
      confirmButtonText: '确定清除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const result = await window.electronAPI.dataClearPrototype()
    if (result.success) {
      await prototypeStore.loadTasks()
      ElMessage.success('产品原型历史已清除')
    } else {
      ElMessage.error(result.error || '清除失败')
    }
  } catch {
    // 用户取消
  }
}

async function handleClearDesign() {
  try {
    await ElMessageBox.confirm('确定要清除所有设计文档吗？\n\n此操作不可恢复！', '警告', {
      confirmButtonText: '确定清除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const result = await window.electronAPI.dataClearDesign()
    if (result.success) {
      await designDocStore.loadTasks()
      ElMessage.success('设计文档历史已清除')
    } else {
      ElMessage.error(result.error || '清除失败')
    }
  } catch {
    // 用户取消
  }
}

function resetPrompts() {
  settingsStore.resetPrompts()
  form.prompts = { ...settingsStore.settings.prompts }
  ElMessage.success('提示词已恢复默认')
}

async function handleOpenFolder() {
  await window.electronAPI.appOpenConfigFolder()
}

async function handleOpenConfigFolder() {
  const result = await window.electronAPI.configGetPath()
  if (result.success && result.data) {
    // 假设 backend 已经支持 openExternal 或者我们直接打开文件夹
    // 此处简化，仅显示路径，实际可以用 shell.showItemInFolder
    await window.electronAPI.appOpenConfigFolder()
  }
}

async function refreshConfigJson() {
  const result = await window.electronAPI.configGet()
  if (result.success) {
    configJsonStr.value = JSON.stringify(result.data, null, 2)
  }
}

onMounted(async () => {
  // 初始化 settingsStore 同步 config.json
  await settingsStore.init()
  // 同步 form 内容
  Object.assign(form, settingsStore.settings)
  
  // 加载路径信息
  const dbResult = await window.electronAPI.appGetConfigPath()
  if (dbResult.success) dbPath.value = dbResult.data || ''
  
  const configResult = await window.electronAPI.configGetPath()
  if (configResult.success) {
    realConfigPath.value = configResult.data || ''
    await refreshConfigJson()
  }
})
</script>

<style scoped>
.settings-page {
  height: 100%;
  background: var(--bg);
}

.settings-inner {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.settings-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: var(--border);
}

.settings-tabs :deep(.el-tabs__content) {
  padding-top: 20px;
  overflow: visible;
}

.settings-card { flex-shrink: 0; }

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--text-primary);
}

.settings-form { max-width: 540px; }

/* 提示词列表 */
.prompts-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.prompt-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.prompt-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.prompt-key {
  font-size: 12px;
  font-family: monospace;
  color: var(--text-tertiary);
  background: var(--bg-gray);
  padding: 2px 6px;
  border-radius: 4px;
}

.field-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
  line-height: 1.5;
}

.form-actions {
  display: flex;
  gap: 12px;
  padding-top: 8px;
}

/* 模板 */
.templates {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.template-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
}
.template-item:hover { border-color: var(--primary); background: var(--primary-lighter); }

.template-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.template-info { flex: 1; }
.template-name { font-size: 14px; font-weight: 500; color: var(--text-primary); }
.template-url { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; font-family: monospace; }

/* 数据管理 */
.data-actions { display: flex; flex-direction: column; }

.data-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}
.data-info { flex: 1; }
.data-title { font-size: 14px; font-weight: 500; color: var(--text-primary); }
.data-desc { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

.config-path-section {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 12px 0;
  gap: 16px;
}
.config-path-info { flex: 1; min-width: 0; }
.path-display {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--bg-gray);
  border-radius: 4px;
  border: 1px solid var(--border);
  overflow: hidden;
}
.path-display code {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
  white-space: pre-wrap;
}

/* JSON Viewer */
.config-json-viewer {
  display: flex;
  flex-direction: column;
}
.json-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  background: var(--bg-gray);
  padding: 8px 12px;
  border-radius: 4px;
}
.json-path {
  font-family: monospace;
  font-size: 11px;
  color: var(--text-tertiary);
  word-break: break-all;
}
.json-content {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 8px;
  max-height: 500px;
  overflow: auto;
}
.json-content pre {
  margin: 0;
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.6;
}
</style>
