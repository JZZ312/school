<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { login } from '../api';

const router = useRouter();
const route = useRoute();

const form = reactive({ username: 'admin', password: '' });
const loading = ref(false);

async function handleLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入用户名和密码');
    return;
  }

  loading.value = true;
  try {
    await login(form.username, form.password);
    ElMessage.success('登录成功');
    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
  } catch (err: any) {
    ElMessage.error(err.message || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <img src="/logo.png" alt="校徽" class="login-logo" onerror="this.style.display='none'" />
        <h1>新闻管理后台</h1>
        <p>南阳市第二完全学校高级中学</p>
      </div>
      <el-form @submit.prevent="handleLogin" size="default">
        <el-form-item>
          <el-input
            v-model="form.username"
            placeholder="用户名"
            prefix-icon="User"
            maxlength="50"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            prefix-icon="Lock"
            maxlength="100"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-button
          type="primary"
          :loading="loading"
          native-type="submit"
          class="login-btn"
        >
          登 录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 50%, #81d4fa 100%);
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.1);
  padding: 48px 40px;
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
}

.login-logo {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
}

.login-header h1 {
  font-family: 'Noto Serif SC', serif;
  font-size: 24px;
  color: #111827;
  margin-bottom: 8px;
  letter-spacing: 2px;
}

.login-header p {
  font-size: 14px;
  color: #6b7280;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  letter-spacing: 4px;
}

/* Override Element Plus input sizing */
:deep(.el-input__wrapper) {
  padding: 1px 12px;
  height: 40px;
}
</style>
