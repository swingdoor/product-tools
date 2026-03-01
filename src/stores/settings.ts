import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { settingsApi } from '@/api/settingsApi'


export interface SearchConfig {
  enabled: boolean
  bochaApiKey: string
}

export interface VectorSearchConfig {
  documentSearch: {
    threshold: number // 0.0 - 1.0
    topK: number // integer
  }
  taskSearch: {
    threshold: number // 0.0 - 1.0
    topK: number // integer
  }
}

export interface APIProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: string // comma-separated strings
}

/** AI 配置 */
export interface AISettings {
  providers: APIProvider[]

  // 选中的大模型服务
  activeLlmProviderId: string
  activeLlmModel: string

  // 选中的 Embedding 服务
  activeEmbeddingProviderId: string
  activeEmbeddingModel: string

  prompts: Record<string, string>
  searchConfig: SearchConfig
  vectorSearch: VectorSearchConfig
}

const STORAGE_KEY = 'pt_settings'

import { DEFAULT_PROMPTS } from '@/constants/prompts'


function loadFromStorage(): AISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      // 处理 prompts 默认值
      if (!data.prompts) {
        data.prompts = { ...DEFAULT_PROMPTS }
      } else {
        for (const key in DEFAULT_PROMPTS) {
          if (!data.prompts[key]) {
            data.prompts[key] = DEFAULT_PROMPTS[key]
          }
        }
      }
      // 处理 searchConfig
      if (!data.searchConfig) {
        data.searchConfig = { enabled: false, bochaApiKey: '' }
      }
      // 处理 vectorSearch
      if (!data.vectorSearch) {
        data.vectorSearch = {
          documentSearch: { threshold: 0.3, topK: 10 },
          taskSearch: { threshold: 0.3, topK: 10 }
        }
      } else if (data.vectorSearch.threshold !== undefined) {
        // Migration from old vectorSearch
        data.vectorSearch = {
          documentSearch: { threshold: data.vectorSearch.threshold, topK: data.vectorSearch.topK || 10 },
          taskSearch: { threshold: data.vectorSearch.threshold, topK: data.vectorSearch.topK || 10 }
        }
      }

      // 数据结构迁移逻辑
      let migratedData = data
      if (data.apiKey !== undefined && data.baseUrl !== undefined) {
        // 这是旧版本数据，需要迁移到 providers 结构
        const defaultProvider: APIProvider = {
          id: 'provider_default_legacy',
          name: '默认厂商 (原有配置迁移)',
          baseUrl: data.baseUrl,
          apiKey: data.apiKey,
          models: 'deepseek-reasoner, deepseek-chat, gpt-4o, o3-mini'
        }

        const embeddingProvider: APIProvider = {
          id: 'provider_embedding_legacy',
          name: '默认 Embedding (原有配置迁移)',
          baseUrl: data.embeddingConfig?.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          apiKey: data.embeddingConfig?.apiKey || '',
          models: 'text-embedding-v3, text-embedding-v2, text-embedding-3-small'
        }

        const newSettings: AISettings = {
          providers: [defaultProvider, embeddingProvider],
          activeLlmProviderId: defaultProvider.id,
          activeLlmModel: data.model || 'deepseek-reasoner',
          activeEmbeddingProviderId: embeddingProvider.id,
          activeEmbeddingModel: data.embeddingConfig?.model || 'text-embedding-v3',
          prompts: data.prompts,
          searchConfig: data.searchConfig,
          vectorSearch: data.vectorSearch || {
            documentSearch: { threshold: 0.3, topK: 10 },
            taskSearch: { threshold: 0.3, topK: 10 }
          }
        }

        // 删除旧字段
        delete (newSettings as any).apiKey;
        delete (newSettings as any).baseUrl;
        delete (newSettings as any).model;
        delete (newSettings as any).embeddingConfig;

        migratedData = newSettings as any
      }

      // 确保新结构包含默认值
      if (!migratedData.providers || !Array.isArray(migratedData.providers)) {
        migratedData.providers = []
      }
      if (!migratedData.activeLlmProviderId) migratedData.activeLlmProviderId = ''
      if (!migratedData.activeLlmModel) migratedData.activeLlmModel = ''
      if (!migratedData.activeEmbeddingProviderId) migratedData.activeEmbeddingProviderId = ''
      if (!migratedData.activeEmbeddingModel) migratedData.activeEmbeddingModel = ''

      return migratedData
    }
  } catch { }

  // 全新的默认空白状态
  const defaultProviderId = 'provider_' + Date.now()
  return {
    providers: [
      {
        id: defaultProviderId,
        name: 'DeepSeek (官方)',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: '',
        models: 'deepseek-reasoner, deepseek-chat'
      }
    ],
    activeLlmProviderId: defaultProviderId,
    activeLlmModel: 'deepseek-reasoner',
    activeEmbeddingProviderId: defaultProviderId,
    activeEmbeddingModel: 'text-embedding-v3',
    prompts: { ...DEFAULT_PROMPTS },
    searchConfig: { enabled: false, bochaApiKey: '' },
    vectorSearch: {
      documentSearch: { threshold: 0.3, topK: 10 },
      taskSearch: { threshold: 0.3, topK: 10 }
    }
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AISettings>(loadFromStorage())

  const isConfigured = computed(() => {
    return settings.value.providers.length > 0 && !!settings.value.activeLlmProviderId
  })

  const resolvedLlmConfig = computed(() => {
    const provider = settings.value.providers.find(p => p.id === settings.value.activeLlmProviderId)
    return {
      apiKey: provider?.apiKey || '',
      baseUrl: provider?.baseUrl || '',
      model: settings.value.activeLlmModel || ''
    }
  })

  const resolvedEmbeddingConfig = computed(() => {
    const provider = settings.value.providers.find(p => p.id === settings.value.activeEmbeddingProviderId)
    return {
      apiKey: provider?.apiKey || '',
      baseUrl: provider?.baseUrl || '',
      model: settings.value.activeEmbeddingModel || ''
    }
  })

  // ────────────────────────────────────────────────────────────
  // 同步逻辑
  // ────────────────────────────────────────────────────────────

  /** 初始化：从后端 config.json 加载并同步 */
  async function init() {
    if (!window.electronAPI) return

    const result = await settingsApi.getConfig()
    if (result.success && result.data) {
      const backendSettings = result.data
      // 判断是否是旧结构（包含 apiKey），如果是，说明后端存储的是老数据
      if (backendSettings.apiKey !== undefined && backendSettings.baseUrl !== undefined) {
        // 我们采用前端刚做完 loadFromStorage 迁移好的结构，直接覆盖后端即可
        await settingsApi.saveConfig(JSON.parse(JSON.stringify(settings.value)))
        return
      }

      // 否则说明后端也是新结构，直接应用后端数据
      if (backendSettings.providers && backendSettings.providers.length > 0) {
        settings.value = {
          ...backendSettings,
          // 确保 prompts 完整
          prompts: { ...DEFAULT_PROMPTS, ...backendSettings.prompts },
          // 确保 vectorSearch 完整
          vectorSearch: backendSettings.vectorSearch || {
            documentSearch: { threshold: 0.3, topK: 10 },
            taskSearch: { threshold: 0.3, topK: 10 }
          }
        }
      } else {
        // 后端为空，将前端 localStorage 里的内容同步到后端
        await settingsApi.saveConfig(JSON.parse(JSON.stringify(settings.value)))
      }
    }
  }

  /** 保存配置：前端 + 后端同步 */
  async function save(newSettings: AISettings) {
    settings.value = { ...newSettings }
    // 固化到本地 localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))

    // 同步到后端 config.json
    if (window.electronAPI) {
      await settingsApi.saveConfig(JSON.parse(JSON.stringify(settings.value)))
    }
  }

  function resetPrompts() {
    settings.value.prompts = { ...DEFAULT_PROMPTS }
    save(settings.value)
  }

  function getPrompt(key: string): string {
    return settings.value.prompts[key] || DEFAULT_PROMPTS[key] || ''
  }

  return {
    settings,
    isConfigured,
    resolvedLlmConfig,
    resolvedEmbeddingConfig,
    save,
    resetPrompts,
    getPrompt,
    DEFAULT_PROMPTS,
    init
  }
})
