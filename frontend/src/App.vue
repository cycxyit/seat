<template>
  <div class="app">
    <!-- Header -->
    <header class="site-header">
      <div class="header-inner">
        <div class="logo-area">
          <img v-if="siteConfig.logo_url" :src="siteConfig.logo_url" class="site-logo" alt="Logo" @error="logoError = true" />
          <div v-else class="logo-icon">🏢</div>
          <div class="site-title-group">
            <h1 class="site-title">{{ siteConfig.site_name || '科室座位预订系统' }}</h1>
            <p class="site-sub">在线选座 · 实时同步</p>
          </div>
        </div>
        <nav class="main-nav">
          <router-link to="/" class="nav-link" active-class="nav-active">📋 选座预订</router-link>
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="main-content">
      <router-view />
    </main>

    <!-- Footer -->
    <footer class="site-footer">
      <div class="footer-inner">
        <span v-html="siteConfig.footer_text"></span>
        <span> | ❤️Powered by cycxtit</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, provide } from 'vue'
import { configAPI } from './services/api.js'

const siteConfig = ref({
  site_name: '科室座位预订系统',
  logo_url: '',
  footer_text: '© 2025 科室座位预订系统. All rights reserved.',
  max_subjects: '3'
})
const logoError = ref(false)

onMounted(async () => {
  try {
    const res = await configAPI.getPublicConfig()
    if (res.data.success) {
      siteConfig.value = { ...siteConfig.value, ...res.data.data }
    }
  } catch (e) {
    // Use defaults silently
  }
})

// Provide config to all child components
provide('siteConfig', siteConfig)
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

/* ── Header ───────────────────────────── */
.site-header {
  background: #FFFFFF;
  border-bottom: 1.5px solid var(--border);
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 32px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.site-logo {
  height: 40px;
  width: auto;
  object-fit: contain;
  border-radius: 6px;
}

.logo-icon {
  font-size: 28px;
  line-height: 1;
}

.site-title-group { display: flex; flex-direction: column; gap: 1px; }

.site-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.3px;
  line-height: 1.2;
}

.site-sub {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 400;
  letter-spacing: 0.05em;
}

/* ── Navigation ───────────────────────── */
.main-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 13.5px;
  font-weight: 500;
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  transition: all var(--transition);
  border: 1.5px solid transparent;
}

.nav-link:hover {
  background: var(--primary-ultra-light);
  color: var(--primary-dark);
  border-color: var(--primary-light);
}

.nav-active {
  background: var(--primary-ultra-light);
  color: var(--primary-dark);
  border-color: var(--primary-light);
  font-weight: 600;
}

/* ── Main ─────────────────────────────── */
.main-content {
  flex: 1;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 36px 24px;
}

/* ── Footer ───────────────────────────── */
.site-footer {
  background: #FFFFFF;
  border-top: 1.5px solid var(--border);
  padding: 18px 24px;
  text-align: center;
}

.footer-inner {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 1280px;
  margin: 0 auto;
}

@media (max-width: 640px) {
  .header-inner { padding: 0 16px; }
  .site-title { font-size: 15px; }
  .site-sub { display: none; }
  .main-content { padding: 20px 12px; }
}
</style>
