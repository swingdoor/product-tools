<template>
  <div class="app-container">
    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ 'is-collapsed': isCollapsed }">
      <div class="sidebar-logo">
        <div class="logo-icon">
          <el-icon size="24" color="#165DFF"><DataAnalysis /></el-icon>
        </div>
        <span v-if="!isCollapsed" class="logo-text">ProductTools</span>
      </div>

      <nav class="sidebar-nav">
        <el-tooltip
          v-for="item in navItems"
          :key="item.path"
          :content="item.label"
          placement="right"
          :disabled="!isCollapsed"
        >
          <router-link
            :to="item.path"
            class="nav-item"
            :class="{ active: currentPath === item.path }"
          >
            <el-icon size="18"><component :is="item.icon" /></el-icon>
            <span v-if="!isCollapsed">{{ item.label }}</span>
            <span v-if="!isCollapsed && item.badge" class="nav-badge">{{ item.badge }}</span>
          </router-link>
        </el-tooltip>
      </nav>

      <div class="sidebar-footer">
        <el-tooltip content="设置" placement="right" :disabled="!isCollapsed">
          <router-link to="/settings" class="nav-item" :class="{ active: currentPath === '/settings' }">
            <el-icon size="18"><Setting /></el-icon>
            <span v-if="!isCollapsed">设置</span>
          </router-link>
        </el-tooltip>
        
        <div class="collapse-toggle" @click="isCollapsed = !isCollapsed">
          <el-icon size="18">
            <Expand v-if="isCollapsed" />
            <Fold v-else />
          </el-icon>
          <span v-if="!isCollapsed">收起菜单</span>
        </div>
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
        <div class="page-wrapper">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()
const isCollapsed = ref(false)

const navItems: { path: string; label: string; icon: string; tag: string | null; badge?: string }[] = [
  { path: '/market-insight', label: '市场洞察', icon: 'TrendCharts', tag: 'DeepResearch' },
  { path: '/product-analysis', label: '需求分析', icon: 'Document', tag: null },
  { path: '/product-prototype', label: '产品原型', icon: 'Grid', tag: null },
  { path: '/design-doc', label: '设计文档', icon: 'Notebook', tag: null },
  { path: '/knowledge-base', label: '文档管理', icon: 'FolderOpened', tag: null }
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
  --sidebar-width-expanded: 210px;
  --sidebar-width-collapsed: 64px;
}

/* ── 侧边栏 ─────────────────────────────────────────────── */
.sidebar {
  width: var(--sidebar-width-expanded);
  background: var(--bg-white);
  border-right: 1px solid var(--border-split);
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: width 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
  flex-shrink: 0;
}

.sidebar.is-collapsed {
  width: var(--sidebar-width-collapsed);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  height: 64px;
  overflow: hidden;
  white-space: nowrap;
}
.sidebar.is-collapsed .sidebar-logo {
  padding: 16px 0;
  justify-content: center;
}
.logo-icon {
  width: 32px;
  height: 32px;
  background: var(--primary);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo-icon .el-icon {
  color: #fff !important;
}
.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.sidebar-nav {
  flex: 1;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-x: hidden;
}

.sidebar.is-collapsed .sidebar-nav {
  padding: 8px 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
  position: relative;
  cursor: pointer;
  white-space: nowrap;
}

.sidebar.is-collapsed .nav-item {
  justify-content: center;
  padding: 10px 0;
}
.nav-item:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.nav-item.active {
  background: var(--primary-lighter);
  color: var(--primary);
  font-weight: 500;
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
  padding: 8px 12px;
  border-top: 1px solid var(--border-split);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar.is-collapsed .sidebar-footer {
  padding: 8px 8px;
}

.collapse-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.collapse-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar.is-collapsed .collapse-toggle {
  justify-content: center;
  padding: 10px 0;
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
  border-bottom: 1px solid var(--border-split);
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
  padding: 16px;
  background: var(--bg);
}

.page-wrapper {
  width: 100%;
  height: 100%;
  background: var(--bg-white);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
