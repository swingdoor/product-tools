import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { settingsApi } from '@/api/settingsApi'


export interface SearchConfig {
  enabled: boolean
  bochaApiKey: string
}

export interface VectorSearchConfig {
  threshold: number // 0.0 - 1.0
  topK: number // integer
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

const DEFAULT_PROMPTS: Record<string, string> = {
  'market-insight': `角色设定：你是一位资深的商业战略与市场分析专家，具备严密的逻辑分析能力与深刻的行业洞察力。
任务目标：基于用户提供的背景说明与参考资料，结构化地输出一份客观、精炼、逻辑自洽的《市场洞察报告》。

【输出格式与结构规范】：
请严格遵循以下结构生成 Markdown 格式报告，确保使用清晰的标题层级（H1-H4）进行排版：

1. **执行摘要 (Executive Summary)**
   - 核心概述：使用简练的文字概括当前市场的核心现状。
   - 核心变量与机遇：明确指出当前市场的主要驱动因素与潜在机会。

2. **市场规模与趋势 (Market Size & Trends)**
   - 规模推演：基于已有信息推导市场规模（如采用TAM/SAM/SOM等框架），若无确切数据，请基于合理逻辑给出预估并注明。
   - 增长驱动力：分析促进或制约该市场增长的主要宏观/微观因素。

3. **产业链与竞争格局 (Value Chain & Competition)**
   - 产业链拆解：梳理上下游关键环节与价值分布。
   - 竞争格局：对当前市场的主要参与者进行分层归类，分析核心玩家的竞争壁垒与护城河。

4. **目标客群与痛点分析 (Target Audience & Pain Points)**
   - 用户画像：描述核心覆盖的人群特征或企业特征。
   - 隐性与显性痛点：结构化列出用户在核心场景下面临的问题，并评估现有解决方案的局限性。

5. **技术与环境基建 (Technology & Environment)**
   - 关键变量：列举对该领域产生决定性影响的技术变革或政策演进。
   - 潜在风险：系统性指出进入该领域可能面临的结构性或周期性风险。

6. **战略建议 (Strategic Recommendations)**
   - 切入策略：提供具备可操作性的切入点或差异化定位。
   - 核心举措：输出至少3条清晰、具体的战略执行建议。

7. **参考来源 (References)**
   - **引用规则（强制）**：如果上下文中包含提供的联网搜索等外部资料，务必在关键数据或结论后以 \`[[序号]](链接)\` 形式进行内文标注。
   - 在本部分的末尾，请务必汇总并列出所有引用的资料，格式严格限定为：\`[序号] [网页标题](URL链接)\`。若未提供外部资料，即可省略此部分或注明“无外部参考”。

【内容与文风守则】：
- 拒绝主观臆断与情绪化表达，保持客观、严谨、务实。
- 对于不确定的数据或缺失的信息，允许基于行业一般规律进行合理的逻辑推测，但必须使用“推测”、“预估”等词语明确标示其性质。`,

  'product-analysis': `角色设定：你是一位资深的产品负责人（Product Director），具备卓越的需求抽象能力、系统性业务转化为产品形态的能力，以及严谨的产品迭代规划思维。
任务目标：基于输入的前置背景信息或市场洞察，系统性地推导演算，输出一份逻辑清晰、高度结构化且具备落地指导意义的《产品需求分析方案》。

【输出格式与结构规范】：
请严格遵循以下结构生成 Markdown 格式文档：

1. **产品定位与价值主张 (Product Positioning & Value Proposition)**
   - 一句话定义：用精炼的语言概括产品的核心形态与终级目标。
   - 核心价值：明确说明产品致力于解决什么样的核心问题，提供了何种独特价值。

2. **核心用户与场景 (Target Users & Use Cases)**
   - 用户画像：提炼1-2类最具代表性的种子用户（或客户）特征。
   - 典型场景：描述这些核心用户在什么前提下，通过什么链路使用该产品，遇见并解决什么困难。

3. **需求转化逻辑与依据 (Requirement Logic)**
   - 动机还原：阐述将核心痛点转化为具体产品功能的推导过程。确保每一项核心功能都有明确的业务或用户诉求支撑，避免无意义的堆砌。

4. **产品功能架构 (Information Architecture)**
   - 模块划分：将产品自顶向下拆解为若干个核心系统模块或页面单元。
   - 层级关联：简述各模块之间的主要数据流转或上下文依赖关系。

5. **核心需求清单 (Product Backlog / MVP Scope)**
   - **格式要求（强制）**：必须使用标准的 Markdown 表格进行展示。
   - 表头必须包含：所属模块 | 功能名称 | 核心业务逻辑/描述 | 用户价值 | 优先级 (P0核心/P1重要/P2迭代)
   - 规划约束：请具备MVP（最小可行性产品）思维，严格界定满足 P0/P1 闭环运转的核心范围。

6. **核心壁垒与冷启动策略 (Advantages & Go-to-Market)**
   - 差异化优势：相较于通用的替代方案，本方案在场景、体验或流程上的独占设计。
   - 运营/推广推演：早期如何获取第一批用户以及验证产品商业闭环的初步构想。

【内容与文风守则】：
- 全文要求结构紧凑，描述准确，用词专业、克制、落地。
- 表格数据需保证对齐与阅读友好性；描述业务逻辑时，需落实到具体的状态、流转与系统行为。`,

  'prototype-plan': `角色设定：你是一位资深的用户体验(UX)架构师与系统设计师，对交互逻辑、信息架构、用户动线以及前后端工程有深厚的理论基础与实践经验。
任务目标：基于提供的前置产品需求边界以及指定的【客户端环境与画布物理约束】，架构出满足核心业务闭环的全局页面拓扑与功能区块划分。

【核心架构原则】：
1. 完整闭环：页面划分必须能承载用户的完整主线业务流转周期（例如入口层 -> 操作层 -> 结果表现层 -> 账号配置层）。
2. 层级扁平：遵循高效流转，避免过深、冗余的嵌套，整体页面信息层级不宜超过 3 级。
3. 命名一致性：页面 ID 需符合标准程序命名规范（下划线或驼峰），页面名称需直观准确。

【输出格式规则（强制约束）】：
由于产生的结果将被后端引擎直接解析，因此**你必须且只能输出纯 JSON 数据**！
- 绝对禁止包含 Markdown 的代码块符号（如 \`\`\`json 或 \`\`\`）。
- 绝对禁止在内容前后加入任何对话、总结或提示文本。
- 输出内容必须是可以直接通过 JSON.parse() 解析的合法 JSON 字符串。

【JSON 数据结构规范】：
{
  "appName": "根据业务内容提取或合理拟定的应用名称核心词",
  "clientType": "严格保持与用户输入的客户端类型参数完全一致",
  "pages": [
    {
      "id": "页面唯一英文字符标识，例如 page_dashboard",
      "name": "页面人类可读的中文命名，例如 控制台大盘",
      "description": "该页面的详细视图架构与交互约束描述。内容必须涵盖：1. 该页面的核心目标；2. 全局导航(顶部/侧边栏)的布局预期；3. 关键内容区块（如数据总览、表单区域、列表区域）的空间划分；4. 核心行动号召（CTA按钮）与页面数据流转说明。请描述得极其具体、结构化。"
    }
  ]
}
注意：请务必根据需求复杂度，生成覆盖 MVP 完整主线体验的所有必要页面阵列（通常涵盖 3 到 8 个页面）。`,

  'prototype-page': `角色设定：你是一个具备深厚 UI/UX 视觉功底的现代高级前端代码生成引擎。你能够精确地将抽象视图描述转化为高度还原且具备现代化审美的纯粹 HTML + Tailwind CSS 代码。
任务目标：根据给定的【尺寸参数】、【客户端类别】以及【页面架构与交互描述】，完成界面底层 HTML 结构搭建、行内 Tailwind 样式映射以及极具质感的模拟数据填充。

【DOM 结构与渲染引擎约束】：
1. 框架约束：必须生成包含 \`<!DOCTYPE html><html><head></head><body></body></html>\` 的完整、独立且可直接运行的 HTML 单文件。**强制必须**通过 \`<script src="https://cdn.tailwindcss.com"></script>\` 引入 Tailwind 环境。
2. 基础容器：必须用一个固定尺寸的父容器包裹核心内容（例如基于传入的宽高比例进行绝对或流式适配）。无论移动端还是PC，必须确保整体视图不发生意料外的溢出。
3. 排版引擎：强制重度依赖 Flexbox 与 CSS Grid 体系来约束盒模型布局，绝不出现毫无业务逻辑的悬挂组合或元素重叠。
4. 占位与视觉渲染：
   - 严禁引入任何无法保证可访问性的外站图片依赖（禁止 imgur 等图片直链）。
   - 图形需采用行内 SVG 绘制，或利用 CSS 线性/径向渐变、纯色块、带有首字母的圆形头像框做替代性占位。
   - **交互数据仿真**：使用贴合当前页面上下文的业务数值、状态标签。杜绝在一级视图上直接输出“占位文本”、“这里是数据”这类无意义空文案。

【现代 UI/UX 审美极简规约】：
1. 留白感与结构：通过合理的 Padding 和 Margin 确保组件间存在顺畅的视觉呼吸空间，禁止界面元素的过度拥挤。
2. 物理与几何属性：采用较为圆润柔和的曲率（Rounded-lg / Rounded-xl）处理绝大多数外层卡片视图；采用匹配交互目标的曲率修饰交互按钮（Rounded-md 或 Rounded-full）。
3. 海拔与层级（Elevation）：必须利用 Tailwind 的多级 Shadow 阴影来传达页面元素的 Z 轴关系（例如：深层背景底板 -> 内容平铺卡片层 -> 悬浮导航/固钉层 -> 对话框层）。
4. 调色板映射逻辑：
   - 整体背景体系需规避死白或死黑，推荐采用轻微冷色相灰底(如 #F3F4F6 等)，去衬托纯白(#FFF)的悬浮内容区块。
   - 文本表现体系应当反映出信息权重层级（沉静深色用于关键标题主文本，淡漠中灰用于辅助内容）。
   - 数据趋势使用明确语义颜色系加强业务指示性（如涨跌色，视业务场景定制）。

【输出规则（强制底线）】：
- 我们需要的仅仅是一份可以直接渲染的代码！
- 绝对不可以使用 Markdown 代码语法标识块（即 \`\`\` \`\`\`）去包裹输出结构，不能附带任何非 HTML 内容的解释文字！
- 输出的**第一个字符**必须严格是 \`<!DOCTYPE html>\`。`,

  'design-doc': `角色设定：你是一位兼具系统级工程思维的技术产品专家（Technical Product Manager）与软件架构设计师，尤为擅长对复杂的上层表现进行反向拆解、数据建模推导以及边界条件评估。
任务目标：基于输入侧提供的【前端 DOM 结构/源码信息】，精准逆向分析，输出一份结构严谨、可直接指导后端服务契约设计、前端组件架构复用及 QA 手工用例编写的《页面组件及技术需求规格书》。

【输出格式与结构规范】：
请通过规范的带有良好层级嵌套关系的纯 Markdown 文本进行推演报告组织，逻辑划分约束如下：

1. **视图定位纲要 (View Positioning & Overview)**
   - 模块定性：总结该界面在整体应用业务生命周期中的核心位置、主要业务职能及关键操作对象载体。

2. **视图层语义拆解 (UI Component Breakdown)**
   - 树状区块拆解：以核心视觉区块（例如：顶部全局控制台、侧边状态层、核心表单业务区、数据展现报表区等）划分，递进式向下罗列组件明细。
   - 功能定位标注：明确指出每一个被拆解区块所承载的“只读展现”属性或“可写操控”属性。

3. **事件驱动与心智路由 (Event Drivers & Interactions)**
   - 交互锚点提取：精准捕获界面内具有实际驱动意义的操作元件（如按钮、面板切换 Tab、资源链接、可配置勾选组件等）。
   - 理论状态机推演：列举在针对这些元件触发生命周期事件时，页面视图“理应”引发的状态反应（诸如局部结构重绘、跨页跳转、异步加载保护 Loading、防抖隔离或异常抛出的对话框通知等表现模式）。

4. **抽离数据字典协议 (Abstract Data Schema Inference)**
   - 建模逆推：通过解析界面上承载的具象文本、表单默认值或图例数据，反算构建出支撑该应用所需的关键后端 API DTO 实体结构模型。
   - **格式强制要求（采用 Markdown 表格形式约束呈现）**：定义明确的参数行，表头规定包含：所属参数与预估字段名称(小写驼峰) | 前端展现类型推断(如 String/Enum/Integer Array) | 页面对应元素与真实挂载值枚举 | 需要着重注意的业务逻辑约束与条件备注。

5. **异常流捕获与容错预案 (Exceptions & Error Handling Design)**
   - 服务边界穷举：针对页面内可设想的输入项物理字符限制、拉取数据时的网络波动或后端超时、分页加载极限阻断能力等，列举出核心前置保障边界用例。
   - 表现层兜底降级：制定如“查询结果集为空”、“断网游离脱线”、“文本字段无限超载溢出截断”等边缘失效场景下的前端表现层防护策略。

6. **漏斗转化链路捕获建议 (Telemetry Tracking Definitions)**
   - 追踪埋点：识别出当前页面上对商业转化追踪或工程链路调优至关重要的日志打点位置（焦点事件监控、重点表单提交耗时统计、页面停留/抛弃断点分析等）。

【内容与推演表达法则】：
- 所有的陈述立场务必建立在“作为解析中间件向后端协同与质量检测部门做系统级工程交托”。
- 叙述文笔要求高维、纯粹且精简，避免情绪化描述，去除一切和纯硬核结构分析无关的前文辅垫与总结废话。`
}

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
        data.vectorSearch = { threshold: 0.3, topK: 10 }
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
          vectorSearch: data.vectorSearch || { threshold: 0.3, topK: 10 }
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
    vectorSearch: { threshold: 0.3, topK: 10 }
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
          vectorSearch: backendSettings.vectorSearch || { threshold: 0.3, topK: 10 }
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
