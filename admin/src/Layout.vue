<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { SwitchButton } from '@element-plus/icons-vue';
import { getCurrentUser, logout } from './api';

const router = useRouter();
const username = ref('admin');

onMounted(async () => {
  try {
    const user = await getCurrentUser();
    if (user.loggedIn && user.username) {
      username.value = user.username;
    } else {
      router.replace('/login');
    }
  } catch {
    router.replace('/login');
  }
});

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return; // cancelled
  }

  try {
    await logout();
  } catch {
    /* ignore */
  } finally {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/login');
  }
}
</script>

<template>
  <el-container class="admin-layout">
    <!-- Sidebar -->
    <el-aside width="220px" class="sidebar">
      <div class="sidebar-logo">
        <span>🏫</span>
        <span>新闻管理</span>
      </div>
      <el-menu router default-active="/news" class="sidebar-menu">
        <el-menu-item index="/news">
          <el-icon><Document /></el-icon>
          <span>新闻管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- Main area -->
    <el-container>
      <!-- Top header -->
      <el-header class="top-header">
        <div class="header-left">
          <span class="page-title">新闻内容管理系统</span>
        </div>
        <div class="header-right">
          <span class="current-user">{{ username }}</span>
          <el-button link type="danger" @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>
            退出登录
          </el-button>
        </div>
      </el-header>

      <!-- Content -->
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
}

.sidebar {
  background: #1f2937;
  display: flex;
  flex-direction: column;
}

.sidebar-logo {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-menu {
  border-right: none;
  background: #1f2937;
}

:deep(.sidebar-menu .el-menu-item) {
  color: #d1d5db;
}

:deep(.sidebar-menu .el-menu-item:hover) {
  background: #374151;
  color: white;
}

:deep(.sidebar-menu .el-menu-item.is-active) {
  background: #29B6F6;
  color: white;
}

.top-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5e7eb;
  background: white;
  padding: 0 24px;
}

.header-left {
  display: flex;
  align-items: center;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.current-user {
  font-size: 14px;
  color: #6b7280;
  background: #f9fafb;
  padding: 4px 12px;
  border-radius: 16px;
}

.main-content {
  background: #f9fafb;
  padding: 24px;
}
</style>
