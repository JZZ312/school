<script setup lang="ts">
import { useRoute } from 'vue-router';
import { onMounted } from 'vue';

const route = useRoute();

onMounted(() => {
  document.title = `${route.meta.title ? route.meta.title + ' - ' : ''}新闻管理后台`;
});
</script>

<template>
  <router-view />
</template>

<style>
:root {
  --el-color-primary: #29B6F6;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif; }
</style>
