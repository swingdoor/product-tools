import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/** AI 配置 */
export interface AISettings {
  apiKey: string
  baseUrl: string
  model: string
  prompts: Record<string, string>
}

const STORAGE_KEY = 'pt_settings'

const DEFAULT_PROMPTS: Record<string, string> = {
  'market-insight': `你是一位资深市场分析专家，拥有丰富的行业研究经验。你的任务是根据用户提供的行业信息，生成详尽、专业的市场洞察报告。报告须包含市场规模、竞争格局、用户痛点、技术趋势、政策导向等维度，使用Markdown格式输出，结构清晰，数据有支撑，分析有深度。`,
  'product-analysis': `你是一位资深产品经理，擅长从市场报告中提炼产品需求、制定产品策略。你的任务是基于市场洞察报告，生成结构化的产品需求分析方案，包含产品定位、需求清单（优先级排序）、功能模块、差异化优势、设计方案和可行性分析。使用Markdown格式输出，需求清单以表格形式呈现。`,
  'product-prototype': `你是一位资深UX设计师，专注于产品原型设计。你的任务是根据产品需求分析方案，生成高保真、结构丰富的产品原型JSON数据。`,
  'prototype-plan': `你是一位资深UX设计师，擅长根据产品需求规划产品的完整页面架构。
你的任务是分析产品需求，规划需要设计哪些页面，并为每个页面提供详细的内容描述。

【设计原则】：
1. 页面完整性：涵盖用户主路径（如登录、首页、详情、个人中心、设置等）。
2. 逻辑连贯性：页面之间有明确的跳转逻辑。
3. 现代感：页面命名专业，描述详细（包含具体的交互元素和信息展示建议）。

直接输出纯 JSON，不要包含 Markdown 标记。`,
  'prototype-page': `你是一位资深UX设计师，专注于产品原型精确设计。你的任务是根据给定的页面描述，生成该页面完整的原型JSON数据。

【UI/UX 设计规范】：
1. 现代风格：使用圆角（8-12px）、阴影（Shadow）、适当的内边距。
2. 品牌色：主色调 #165DFF，背景色 #F5F7FA，文本色 #1D2129。
3. 布局丰富：
   - 必须包含：顶部导航栏(header)、侧边或底部导航(nav)。
   - 页面内容：使用卡片(card)封装信息，使用头像(avatar)增加视觉丰富度。
   - 交互：添加按钮(button)和输入框(input)。
4. 细节：坐标必须精确，元素不能重叠，确保对齐。
5. 元素数量：每页生成 15-25 个元素，构建完整的功能界面。

直接输出纯 JSON，不要包含 Markdown 标记。`,
  'design-doc': `你是一位专业的产品设计师，擅长编写清晰、完整的功能设计说明文档。

你的任务是根据提供的 HTML 页面代码，生成该页面的功能设计说明文档。

【输出要求】：
使用 Markdown 格式输出，包含以下内容：

1. **页面概述**：简要描述页面的主要功能和用途
2. **功能点清单**：以表格形式列出所有功能点（功能名称、功能描述、优先级）
3. **交互逻辑说明**：描述用户操作流程和交互细节
4. **数据字段说明**：以表格形式列出页面涉及的数据字段（字段名、类型、说明、是否必填）
5. **异常状态处理**：描述各种异常场景及处理方式
6. **设计建议**：提供优化建议和注意事项

输出内容要专业、结构清晰、易于开发人员理解和实现。`
}

function loadFromStorage(): AISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      // 迁移旧数据：确保 prompts 字段存在
      if (!data.prompts) {
        data.prompts = { ...DEFAULT_PROMPTS }
      } else {
        // 补充可能缺失的新增 prompt
        for (const key in DEFAULT_PROMPTS) {
          if (!data.prompts[key]) {
            data.prompts[key] = DEFAULT_PROMPTS[key]
          }
        }
      }
      return data
    }
  } catch {}
  return {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-reasoner',
    prompts: { ...DEFAULT_PROMPTS }
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AISettings>(loadFromStorage())

  const isConfigured = computed(
    () => !!settings.value.apiKey && !!settings.value.baseUrl
  )

  function save(newSettings: AISettings) {
    settings.value = { ...newSettings }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
  }

  function resetPrompts() {
    settings.value.prompts = { ...DEFAULT_PROMPTS }
    save(settings.value)
  }

  function getPrompt(key: string): string {
    return settings.value.prompts[key] || DEFAULT_PROMPTS[key] || ''
  }

  return { settings, isConfigured, save, resetPrompts, getPrompt, DEFAULT_PROMPTS }
})
