<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, RefreshRight, Search, Edit, View, Delete } from '@element-plus/icons-vue';
import {
  getNewsList,
  deleteNews,
  type Pagination,
} from '../api';
import NewsFormDialog from './NewsForm.vue';

// ── Search & filter state ──
const keyword = ref('');
const categoryFilter = ref('');
const statusFilter = ref('');
const tableLoading = ref(false);

// ── Table data ──
const tableData = ref<any[]>([]);
const pagination = ref<Pagination>({ page: 1, limit: 20, total: 0 });

// ── Form dialog state ──
const showDialog = ref(false);
const editingId = ref<number | null>(null);

const categories = [
  { label: '学校动态', value: '学校动态' },
  { label: '教学教研', value: '教学教研' },
  { label: '学生活动', value: '学生活动' },
  { label: '荣誉成就', value: '荣誉成就' },
  { label: '通知公告', value: '通知公告' },
];

const statusOptions = [
  { label: '全部', value: '' },
  { label: '已发布', value: 'published' },
  { label: '草稿', value: 'draft' },
];

// ── Fetch data ──
async function fetchData() {
  tableLoading.value = true;
  try {
    const res: any = await getNewsList(
      pagination.value.page,
      pagination.value.limit,
      categoryFilter.value || undefined,
      keyword.value || undefined,
      statusFilter.value || undefined,
    );
    tableData.value = res.items || [];
    pagination.value = res.pagination || { page: 1, limit: 20, total: 0 };
  } catch (err: any) {
    ElMessage.error(err.message || '加载新闻列表失败');
  } finally {
    tableLoading.value = false;
  }
}

// ── Actions ──
function handleSearch() {
  pagination.value.page = 1;
  fetchData();
}

function resetSearch() {
  keyword.value = '';
  categoryFilter.value = '';
  statusFilter.value = '';
  pagination.value.page = 1;
  fetchData();
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  fetchData();
}

function handleSizeChange(size: number) {
  pagination.value.limit = size;
  pagination.value.page = 1;
  fetchData();
}

function handleCreate() {
  editingId.value = null;
  showDialog.value = true;
}

function handleEdit(row: any) {
  editingId.value = row.id;
  showDialog.value = true;
}

function handlePreview(row: any) {
  // Open homepage with #news anchor, then open the all-news modal via postMessage
  window.open(`/index.html#news`, '_blank');
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定要删除「${row.title}」吗？此操作不可恢复。`, '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return; // cancelled
  }

  try {
    await deleteNews(row.id);
    ElMessage.success('删除成功');
    fetchData();
  } catch (err: any) {
    ElMessage.error(err.message || '删除失败');
  }
}

function handleSaved() {
  fetchData();
}
</script>

<template>
  <div class="news-list-page">
    <!-- Toolbar -->
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar-row">
        <div class="toolbar-left">
          <el-button type="primary" :icon="Plus" @click="handleCreate">新增新闻</el-button>
          <el-button :icon="RefreshRight" @click="fetchData">刷新</el-button>
        </div>
        <div class="toolbar-center">
          <el-input
            v-model="keyword"
            placeholder="搜索标题..."
            :prefix-icon="Search"
            clearable
            style="width: 240px;"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-button type="primary" plain @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </div>
        <div class="toolbar-right">
          <el-select v-model="categoryFilter" placeholder="分类" clearable style="width: 140px;">
            <el-option
              v-for="cat in categories"
              :key="cat.value"
              :label="cat.label"
              :value="cat.value"
            />
          </el-select>
          <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px;">
            <el-option
              v-for="opt in statusOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </div>
      </div>
    </el-card>

    <!-- Table -->
    <el-card shadow="never" class="table-card">
      <el-table
        v-loading="tableLoading"
        :data="tableData"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="id" label="ID" width="70" align="center" />
        <el-table-column prop="title" label="标题" min-width="280">
          <template #default="{ row }">
            <span class="title-text">{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="110" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="primary">{{ row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : 'info'" size="small">
              {{ row.status === 'published' ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="publish_time" label="发布时间" width="170" align="center">
          <template #default="{ row }">
            {{ row.publish_time || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" align="center">
          <template #default="{ row }">
            {{ row.created_at || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" :icon="Edit" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="success" size="small" :icon="View" @click="handlePreview(row)">查看</el-button>
            <el-button link type="danger" size="small" :icon="Delete" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- Form Dialog (sibling component) -->
    <NewsFormDialog
      v-if="showDialog"
      :edit-id="editingId"
      @close="showDialog = false"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped>
.news-list-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar-card :deep(.el-card__body) {
  padding: 16px 20px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  gap: 8px;
}

.toolbar-center {
  display: flex;
  gap: 8px;
  flex: 1;
  min-width: 300px;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.table-card :deep(.el-card__body) {
  padding: 0;
}

.title-text {
  font-weight: 500;
  color: #1f2937;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding: 16px 20px 8px;
}
</style>
