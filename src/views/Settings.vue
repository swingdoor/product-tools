<template>
  <div class="settings-page">
    <el-scrollbar>
      <div class="settings-inner">
        
        <!-- 选项卡切换 -->
        <el-tabs v-model="activeTab" class="settings-tabs">
          <!-- 1. API 配置 -->
          <el-tab-pane label="API 配置" name="api">
            <!-- 厂商管理 -->
            <el-card shadow="never" class="settings-card">
              <template #header>
                <div class="card-header">
                  <el-icon color="#722ED1"><Box /></el-icon>
                  <span>厂商管理 (API Providers)</span>
                  <el-button type="primary" link @click="openProviderDialog()">
                    <el-icon><Plus /></el-icon> 添加厂商
                  </el-button>
                </div>
              </template>
              
              <el-table :data="form.providers" style="width: 100%" size="small" border>
                <el-table-column prop="name" label="厂商名称" width="150" />
                <el-table-column prop="baseUrl" label="接口地址" show-overflow-tooltip />
                <el-table-column prop="apiKey" label="API Key">
                  <template #default="scope">
                    <span>{{ scope.row.apiKey ? '已配置 (sk-...)' : '未配置' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="可用模型" show-overflow-tooltip>
                  <template #default="scope">
                    <el-tag size="small" v-for="m in scope.row.models.split(',')" :key="m" style="margin-right:4px">
                      {{ m.trim() }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="120" fixed="right">
                  <template #default="scope">
                    <el-button type="primary" link size="small" @click="openProviderDialog(scope.row)">编辑</el-button>
                    <el-button type="danger" link size="small" @click="deleteProvider(scope.row.id)" :disabled="form.providers.length <= 1">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>

            <!-- LLM 接口配置 -->
            <el-card shadow="never" class="settings-card" style="margin-top:20px">
              <template #header>
                <div class="card-header">
                  <el-icon color="#165DFF"><Setting /></el-icon>
                  <span>大模型 (LLM) 接口配置</span>
                  <el-tag v-if="settingsStore.isConfigured" type="success" size="small">已配置</el-tag>
                  <el-tag v-else type="warning" size="small">未配置</el-tag>
                </div>
              </template>

              <el-form :model="form" label-position="top" class="settings-form">
                <el-form-item label="选择服务厂商" required>
                  <el-select v-model="form.activeLlmProviderId" placeholder="请选择厂商" style="width:100%">
                    <el-option
                      v-for="p in form.providers"
                      :key="p.id"
                      :label="p.name"
                      :value="p.id"
                    />
                  </el-select>
                </el-form-item>

                <el-form-item label="选择模型 (Model)" required>
                  <el-select v-model="form.activeLlmModel" filterable allow-create placeholder="请选择或输入模型代码" style="width:100%">
                    <el-option
                      v-for="m in llmModelsList"
                      :key="m"
                      :label="m"
                      :value="m"
                    />
                  </el-select>
                  <div class="field-hint">支持手动输入厂商未收录的模型代码（输入后按回车）</div>
                </el-form-item>

                <div class="form-actions">
                  <el-button type="primary" size="large" @click="saveSettings" :loading="saving">
                    <el-icon><Check /></el-icon> 保存配置
                  </el-button>
                  <el-button size="large" @click="testLlmConnection" :loading="testingLlm">
                    <el-icon><Connection /></el-icon> 测试 LLM 连接
                  </el-button>
                </div>
              </el-form>

              <el-alert
                v-if="testLlmResult"
                :title="testLlmResult.message"
                :type="testLlmResult.success ? 'success' : 'error'"
                :closable="false"
                show-icon
                style="margin-top:16px"
              />
            </el-card>

            <!-- Embedding 接口配置 -->
            <el-card shadow="never" class="settings-card" style="margin-top:20px">
              <template #header>
                <div class="card-header">
                  <el-icon color="#10A37F"><Coin /></el-icon>
                  <span>知识库 Embedding 接口配置</span>
                  <el-tag v-if="form.activeEmbeddingProviderId" type="success" size="small">已配置</el-tag>
                  <el-tag v-else type="warning" size="small">未配置</el-tag>
                </div>
              </template>

              <el-form :model="form" label-position="top" class="settings-form">
                <el-form-item label="选择服务厂商" required>
                  <el-select v-model="form.activeEmbeddingProviderId" placeholder="请选择厂商" style="width:100%">
                    <el-option
                      v-for="p in form.providers"
                      :key="p.id"
                      :label="p.name"
                      :value="p.id"
                    />
                  </el-select>
                </el-form-item>

                <el-form-item label="选择模型 (Model)" required>
                  <el-select v-model="form.activeEmbeddingModel" filterable allow-create placeholder="请选择或输入模型代码" style="width:100%">
                    <el-option
                      v-for="m in embeddingModelsList"
                      :key="m"
                      :label="m"
                      :value="m"
                    />
                  </el-select>
                  <div class="field-hint">一般用于 RAG 知识库检索增强，将文本向量化</div>
                </el-form-item>
                
                <div class="form-actions">
                  <el-button type="primary" size="large" @click="saveSettings" :loading="saving">
                    <el-icon><Check /></el-icon> 保存配置
                  </el-button>
                  <el-button size="large" @click="testEmbeddingConnection" :loading="testingEmbedding">
                    <el-icon><Connection /></el-icon> 测试 Embedding 连接
                  </el-button>
                </div>
              </el-form>

              <el-alert
                v-if="testEmbeddingResult"
                :title="testEmbeddingResult.message"
                :type="testEmbeddingResult.success ? 'success' : 'error'"
                :closable="false"
                show-icon
                style="margin-top:16px"
              />
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

          <!-- 3. 向量检索配置 -->
          <el-tab-pane label="向量检索" name="vector">
            <el-card shadow="never" class="settings-card">
              <template #header>
                <div class="card-header">
                  <el-icon color="#10A37F"><Operation /></el-icon>
                  <span>向量检索配置 (Vector Search)</span>
                </div>
              </template>
              <el-form :model="form" label-position="top" class="settings-form">
                <el-divider content-position="left">文档检索配置 (用于知识库搜索)</el-divider>
                <el-form-item label="相似度阈值 (Threshold)">
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <el-input-number
                      v-model="form.vectorSearch.documentSearch.threshold"
                      :min="0"
                      :max="1"
                      :step="0.01"
                      :precision="2"
                      size="large"
                      style="width: 180px;"
                    />
                    <el-tag border type="success">{{ (form.vectorSearch.documentSearch.threshold * 100).toFixed(0) }}%</el-tag>
                  </div>
                  <div class="field-hint">知识库进行语义搜索时，低于该相似度的结果将被过滤。范围 0.0 - 1.0。建议设置在 0.3 - 0.5 之间。</div>
                </el-form-item>
                
                <el-form-item label="检索数量限制 (TOP K)">
                  <el-input-number
                    v-model="form.vectorSearch.documentSearch.topK"
                    :min="1"
                    :max="50"
                    size="large"
                  />
                  <div class="field-hint">知识库页面语义搜索返回的最大匹配分块数量。默认 10。</div>
                </el-form-item>

                <el-divider content-position="left" style="margin-top: 30px;">分析任务配置 (用于生成报告时的自动检索)</el-divider>
                <el-form-item label="相似度阈值 (Threshold)">
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <el-input-number
                      v-model="form.vectorSearch.taskSearch.threshold"
                      :min="0"
                      :max="1"
                      :step="0.01"
                      :precision="2"
                      size="large"
                      style="width: 180px;"
                    />
                    <el-tag border type="success">{{ (form.vectorSearch.taskSearch.threshold * 100).toFixed(0) }}%</el-tag>
                  </div>
                  <div class="field-hint">AI 生成任务（如市场洞察）开启“自动匹配知识”时，低于该相似度的结果将被忽略。</div>
                </el-form-item>
                
                <el-form-item label="检索数量限制 (TOP K)">
                  <el-input-number
                    v-model="form.vectorSearch.taskSearch.topK"
                    :min="1"
                    :max="50"
                    size="large"
                  />
                  <div class="field-hint">AI 生成任务时自动匹配引入的最大相关知识分块数量。默认 10。</div>
                </el-form-item>

                <div class="form-actions" style="margin-top: 30px;">
                  <el-button type="primary" size="large" @click="saveSettings" :loading="saving">
                    <el-icon><Check /></el-icon> 保存向量配置
                  </el-button>
                </div>
              </el-form>
            </el-card>
          </el-tab-pane>

          <el-tab-pane label="提示词配置" name="prompts">
            <el-card shadow="never" class="settings-card">
              <template #header>
                <div class="card-header" style="justify-content: space-between; width: 100%;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <el-icon color="#FF7D00"><ChatLineSquare /></el-icon>
                    <span>系统提示词 (System Prompts)</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <el-button type="primary" link @click="resetPrompts">
                      <el-icon><Refresh /></el-icon> 恢复默认
                    </el-button>
                    <el-button type="primary" @click="saveSettings" :loading="saving">
                      <el-icon><Check /></el-icon> 保存提示词
                    </el-button>
                  </div>
                </div>
              </template>
              
              <div class="prompts-split-view">
                <el-tabs
                  v-model="activePromptTab"
                  tab-position="left"
                  class="prompts-tabs"
                >
                  <el-tab-pane
                    v-for="(label, key) in promptLabels"
                    :key="key"
                    :label="label"
                    :name="key"
                  >
                    <div class="prompt-editor-container">
                      <el-input
                        v-model="form.prompts[key]"
                        type="textarea"
                        :rows="23"
                        placeholder="输入系统提示词..."
                        class="prompt-textarea"
                      />
                    </div>
                  </el-tab-pane>
                </el-tabs>
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

    <!-- 添加/编辑厂商的 Dialog -->
    <el-dialog
      v-model="providerDialogVisible"
      :title="editingProviderId ? '编辑厂商' : '添加厂商'"
      width="500px"
      align-center
    >
      <div v-if="!editingProviderId" class="templates" style="margin-bottom: 20px;">
        <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px;">从模板快速填充：</div>
        <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;">
          <el-button 
            v-for="tpl in templates" 
            :key="tpl.name" 
            size="small" 
            @click="applyProviderTemplate(tpl)"
          >
            {{ tpl.icon }} {{ tpl.name }}
          </el-button>
        </div>
      </div>

      <el-form :model="providerForm" label-position="top">
        <el-form-item label="厂商名称" required>
          <el-input v-model="providerForm.name" placeholder="例如：DeepSeek、智谱等" />
        </el-form-item>
        <el-form-item label="接口地址 (Base URL)" required>
          <el-input v-model="providerForm.baseUrl" placeholder="https://api..." />
        </el-form-item>
        <el-form-item label="API Key" required>
          <el-input v-model="providerForm.apiKey" type="password" show-password placeholder="sk-..." />
        </el-form-item>
        <el-form-item label="可用模型 (Models)">
          <el-input v-model="providerForm.models" type="textarea" :rows="2" placeholder="填写模型代码，多个请用英文逗号分隔" />
          <div class="field-hint">逗号分隔，如：`deepseek-reasoner, deepseek-chat`</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="providerDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveProviderDialog">确认保存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore, type APIProvider } from '@/stores/settings'
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
const activePromptTab = ref('market-insight')
// 为了防止 form 深拷贝丢失响应式，先克隆一份
const form = ref({
  ...JSON.parse(JSON.stringify(settingsStore.settings)),
  vectorSearch: settingsStore.settings.vectorSearch || { 
    documentSearch: { threshold: 0.3, topK: 10 },
    taskSearch: { threshold: 0.3, topK: 10 }
  }
})
if (!form.value.vectorSearch.documentSearch) {
  form.value.vectorSearch.documentSearch = { threshold: 0.3, topK: 10 }
}
if (!form.value.vectorSearch.taskSearch) {
  form.value.vectorSearch.taskSearch = { threshold: 0.5, topK: 5 }
}

// 模型下拉列表（计算属性）
const llmModelsList = computed(() => {
  const provider = form.value.providers.find((p: APIProvider) => p.id === form.value.activeLlmProviderId)
  return provider && provider.models ? provider.models.split(',').map((s: string) => s.trim()).filter(Boolean) : []
})

const embeddingModelsList = computed(() => {
  const provider = form.value.providers.find((p: APIProvider) => p.id === form.value.activeEmbeddingProviderId)
  return provider && provider.models ? provider.models.split(',').map((s: string) => s.trim()).filter(Boolean) : []
})

// 当切换 LLM 厂商时，自动选中第一个可用模型
watch(() => form.value.activeLlmProviderId, (newId, oldId) => {
  if (oldId && newId !== oldId && llmModelsList.value.length > 0) {
    form.value.activeLlmModel = llmModelsList.value[0]
  }
})
watch(() => form.value.activeEmbeddingProviderId, (newId, oldId) => {
  if (oldId && newId !== oldId && embeddingModelsList.value.length > 0) {
    form.value.activeEmbeddingModel = embeddingModelsList.value[0]
  }
})
const saving = ref(false)
const testingLlm = ref(false)
const testingEmbedding = ref(false)
const testLlmResult = ref<{ success: boolean; message: string } | null>(null)
const testEmbeddingResult = ref<{ success: boolean; message: string } | null>(null)
const dbPath = ref('')
const realConfigPath = ref('')
const configJsonStr = ref('')

// Dialog 相关
const providerDialogVisible = ref(false)
const editingProviderId = ref<string | null>(null)
const providerForm = reactive<APIProvider>({
  id: '',
  name: '',
  baseUrl: '',
  apiKey: '',
  models: ''
})

const searchSources = [
  { id: 'bocha_api', label: '博查 Web Search API', desc: '专为 AI Agent 和 RAG 设计的国内合规搜索 API' }
]

const promptLabels: Record<string, string> = {
  'market-insight': '市场洞察',
  'product-analysis': '需求分析',
  'prototype-plan': '原型页面规划',
  'prototype-page': '单页原型设计',
  'design-doc': '设计文档'
}

const templates = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: 'deepseek-reasoner, deepseek-chat', icon: '🔮', color: '#165DFF' },
  { name: '阿里百炼', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: 'qwen-max, qwen-plus, qwen-turbo, text-embedding-v3, text-embedding-v2', icon: '☁️', color: '#FF7D00' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: 'gpt-4o, o3-mini, text-embedding-3-small, text-embedding-3-large', icon: '🤖', color: '#10A37F' },
  { name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', models: 'moonshot-v1-128k', icon: '🌙', color: '#722ED1' },
  { name: 'OpenAI兼容代理', baseUrl: 'https://your-proxy.com/v1', models: 'gpt-4o', icon: '🔄', color: '#FF7D00' }
]

function openProviderDialog(row?: APIProvider) {
  if (row) {
    editingProviderId.value = row.id
    Object.assign(providerForm, row)
  } else {
    editingProviderId.value = null
    Object.assign(providerForm, { id: 'provider_' + Date.now(), name: '', baseUrl: '', apiKey: '', models: '' })
  }
  providerDialogVisible.value = true
}

function applyProviderTemplate(tpl: typeof templates[0]) {
  providerForm.name = tpl.name
  providerForm.baseUrl = tpl.baseUrl
  providerForm.models = tpl.models
}

function saveProviderDialog() {
  if (!providerForm.name || !providerForm.baseUrl || !providerForm.apiKey) {
    ElMessage.warning('名称、接口地址和 API Key 是必填项')
    return
  }
  if (editingProviderId.value) {
    const idx = form.value.providers.findIndex((p: APIProvider) => p.id === editingProviderId.value)
    if (idx !== -1) form.value.providers[idx] = { ...providerForm }
  } else {
    form.value.providers.push({ ...providerForm })
  }
  providerDialogVisible.value = false
  saveSettings()
}

function deleteProvider(id: string) {
  form.value.providers = form.value.providers.filter((p: APIProvider) => p.id !== id)
  // 如果当前选中的被删除了，选中第一个
  if (form.value.activeLlmProviderId === id && form.value.providers.length > 0) {
    form.value.activeLlmProviderId = form.value.providers[0].id
  }
  if (form.value.activeEmbeddingProviderId === id && form.value.providers.length > 0) {
    form.value.activeEmbeddingProviderId = form.value.providers[0].id
  }
  saveSettings()
}

async function saveSettings() {
  saving.value = true
  // 模拟保存延迟
  await new Promise(resolve => setTimeout(resolve, 300))
  
  await settingsStore.save(JSON.parse(JSON.stringify(form.value)))
  await refreshConfigJson() // 保存后刷新 JSON 预览
  
  saving.value = false
  testLlmResult.value = null
  ElMessage.success('配置已保存并同步至 config.json')
}

async function testLlmConnection() {
  const provider = form.value.providers.find((p: APIProvider) => p.id === form.value.activeLlmProviderId)
  if (!provider || !provider.apiKey.trim() || !provider.baseUrl.trim()) {
    ElMessage.warning('LLM 厂商的 API Key 和接口地址未填写')
    return
  }
  testingLlm.value = true
  testLlmResult.value = null
  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` }
    })
    if (response.ok) {
      testLlmResult.value = { success: true, message: '连接成功！接口配置正确。' }
    } else {
      testLlmResult.value = { success: false, message: `连接失败：HTTP ${response.status} - ${response.statusText}` }
    }
  } catch (err) {
    testLlmResult.value = { success: false, message: `连接失败：${err instanceof Error ? err.message : '网络错误'}` }
  } finally {
    testingLlm.value = false
  }
}

async function testEmbeddingConnection() {
  const provider = form.value.providers.find((p: APIProvider) => p.id === form.value.activeEmbeddingProviderId)
  if (!provider || !provider.apiKey.trim() || !provider.baseUrl.trim()) {
    ElMessage.warning('Embedding 厂商的 API Key 和接口地址未填写')
    return
  }
  testingEmbedding.value = true
  testEmbeddingResult.value = null
  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` }
    })
    if (response.ok) {
      testEmbeddingResult.value = { success: true, message: '连接成功！接口配置正确。' }
    } else {
      testEmbeddingResult.value = { success: false, message: `连接失败：HTTP ${response.status} - ${response.statusText}` }
    }
  } catch (err) {
    testEmbeddingResult.value = { success: false, message: `连接失败：${err instanceof Error ? err.message : '网络错误'}` }
  } finally {
    testingEmbedding.value = false
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
  form.value.prompts = JSON.parse(JSON.stringify(settingsStore.settings.prompts))
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
  const settingsCopy = JSON.parse(JSON.stringify(settingsStore.settings))
  if (!settingsCopy.vectorSearch) {
    settingsCopy.vectorSearch = {
      documentSearch: { threshold: 0.3, topK: 10 },
      taskSearch: { threshold: 0.5, topK: 5 }
    }
  } else {
    if (!settingsCopy.vectorSearch.documentSearch) settingsCopy.vectorSearch.documentSearch = { threshold: 0.3, topK: 10 }
    if (!settingsCopy.vectorSearch.taskSearch) settingsCopy.vectorSearch.taskSearch = { threshold: 0.5, topK: 5 }
  }
  form.value = settingsCopy
  
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
  background-color: var(--border-split);
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

.prompts-split-view {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  min-height: 500px;
}
.prompts-tabs {
  width: 100%;
}
.prompts-tabs :deep(.el-tabs__header.is-left) {
  width: 140px;
  flex-shrink: 0;
}
.prompts-tabs :deep(.el-tabs__content) {
  flex: 1;
}
.prompt-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.prompt-textarea :deep(.el-textarea__inner) {
  font-family: monospace;
  font-size: 13px;
  line-height: 1.6;
  padding: 16px;
  background: var(--bg-white);
  border: 1px solid var(--border-split);
  border-radius: var(--radius-md);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
}
.prompt-textarea :deep(.el-textarea__inner:focus) {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-lighter);
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
  border: 1px solid var(--border-split);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-white);
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
