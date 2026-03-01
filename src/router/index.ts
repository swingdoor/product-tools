import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/market-insight'
    },
    {
      path: '/market-insight',
      name: 'MarketInsight',
      component: () => import('@/views/MarketList.vue'),
      meta: { title: '市场洞察' }
    },
    {
      path: '/market-insight/view/:id',
      name: 'MarketView',
      component: () => import('@/views/MarketView.vue'),
      meta: { title: '市场洞察报告' }
    },
    {
      path: '/product-analysis',
      name: 'AnalysisList',
      component: () => import('@/views/AnalysisList.vue'),
      meta: { title: '需求分析' }
    },
    {
      path: '/product-analysis/view/:id',
      name: 'AnalysisView',
      component: () => import('@/views/AnalysisView.vue'),
      meta: { title: '需求分析查看' }
    },
    {
      path: '/product-prototype',
      name: 'PrototypeList',
      component: () => import('@/views/PrototypeList.vue'),
      meta: { title: '产品原型' }
    },
    {
      path: '/product-prototype/generate/:id',
      name: 'PrototypeGenerate',
      component: () => import('@/views/PrototypeGenerate.vue'),
      meta: { title: '任务生成' }
    },
    {
      path: '/product-prototype/view/:id',
      name: 'PrototypeView',
      component: () => import('@/views/PrototypeView.vue'),
      meta: { title: '结果查看' }
    },
    {
      path: '/design-doc',
      name: 'DesignDocList',
      component: () => import('@/views/DesignDocList.vue'),
      meta: { title: '设计文档' }
    },
    {
      path: '/design-doc/view/:id',
      name: 'DesignDocView',
      component: () => import('@/views/DesignDocView.vue'),
      meta: { title: '设计文档查看' }
    },
    {
      path: '/knowledge-base',
      name: 'KnowledgeBase',
      component: () => import('@/views/KnowledgeBaseList.vue'),
      meta: { title: '文档管理' }
    },
    {
      path: '/knowledge-base/preview/:id',
      name: 'KnowledgePreview',
      component: () => import('@/views/KnowledgePreview.vue'),
      meta: { title: '文档预览' }
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/Settings.vue'),
      meta: { title: '设置' }
    },
    {
      path: '/logs',
      name: 'SystemLog',
      component: () => import('@/views/SystemLog.vue'),
      meta: { title: '日志' }
    }
  ]
})

export default router
