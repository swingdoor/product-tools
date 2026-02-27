<template>
  <div class="app-container">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">
          <el-icon size="24" color="#165DFF"><DataAnalysis /></el-icon>
        </div>
        <span class="logo-text">ProductTools</span>
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: currentPath === item.path }"
        >
          <el-icon size="18"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
          <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <router-link to="/settings" class="nav-item" :class="{ active: currentPath === '/settings' }">
          <el-icon size="18"><Setting /></el-icon>
          <span>设置</span>
        </router-link>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 顶部标题栏 -->
      <header class="page-header">
        <div class="header-left">
          <h1 class="page-title">{{ currentTitle }}</h1>
          <el-tag v-if="currentTag" size="small" type="info" class="page-tag">{{ currentTag }}</el-tag>
        </div>
        <div class="header-right">
          <el-tooltip content="全局AI设置" placement="bottom">
            <el-button
              circle
              size="small"
              :type="settingsStore.isConfigured ? 'success' : 'warning'"
              @click="router.push('/settings')"
            >
              <el-icon><Setting /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tag v-if="settingsStore.isConfigured" size="small" type="success" effect="plain">
            AI已配置
          </el-tag>
          <el-tag v-else size="small" type="warning" effect="plain">
            请配置AI
          </el-tag>
        </div>
      </header>

      <!-- 路由页面 -->
      <div class="page-body">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()

const navItems: { path: string; label: string; icon: string; tag: string | null; badge?: string }[] = [
  { path: '/market-insight', label: '市场洞察', icon: 'TrendCharts', tag: 'DeepResearch' },
  { path: '/product-analysis', label: '需求分析', icon: 'Document', tag: null },
  { path: '/product-prototype', label: '产品原型', icon: 'Grid', tag: null },
  { path: '/design-doc', label: '设计文档', icon: 'Notebook', tag: null }
]

const currentPath = computed(() => route.path)

const currentTitle = computed(() => {
  const item = navItems.find(n => n.path === route.path)
  if (item) return item.label
  if (route.path === '/settings') return '设置'
  return 'ProductTools'
})

const currentTag = computed(() => {
  const item = navItems.find(n => n.path === route.path)
  return item?.tag || null
})
</script>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ── 侧边栏 ─────────────────────────────────────────────── */
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--bg-white);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-sm);
  z-index: 10;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  cursor: default;
}
.logo-icon {
  width: 36px;
  height: 36px;
  background: var(--primary-lighter);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  transition: all 0.15s;
  position: relative;
  cursor: pointer;
}
.nav-item:hover {
  background: var(--bg);
  color: var(--text-primary);
}
.nav-item.active {
  background: var(--primary-lighter);
  color: var(--primary);
  font-weight: 600;
}
.nav-badge {
  margin-left: auto;
  background: var(--primary);
  color: white;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--border);
}

/* ── 主内容区 ────────────────────────────────────────────── */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.page-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--bg-white);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.page-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.page-tag {
  font-size: 11px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-body {
  flex: 1;
  overflow: hidden;
}
</style>
