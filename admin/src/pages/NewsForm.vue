<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { createNews, updateNews, uploadImage } from '../api';

const props = defineProps<{ editId?: number | null }>();
const emit = defineEmits<{ close: []; saved: [] }>();

// Control dialog visibility via v-model
const open = defineModel<boolean>({ default: false });

const categories = [
  '学校动态',
  '教学教研',
  '学生活动',
  '荣誉成就',
  '通知公告',
];

const isEdit = computed(() => !!props.editId);
const titleText = computed(() => (isEdit.value ? '编辑新闻' : '发布新闻'));

// ── Form state ──
const form = reactive({
  title: '',
  summary: '',
  content: '',
  category: categories[0],
  cover_image: '',
  author: '编辑部',
  status: 'published',
  publish_time: new Date().toISOString().slice(0, 16),
});

const uploadingCover = ref(false);
const previewUrl = ref('');
const submitLoading = ref(false);

const fileInputRef = ref<HTMLInputElement | null>(null);

// When dialog opens, fetch existing data if editing
watch(open, async (isOpen) => {
  if (!isOpen) return;
  // Reset form
  form.title = '';
  form.summary = '';
  form.content = '';
  form.category = categories[0];
  form.cover_image = '';
  form.author = '编辑部';
  form.status = 'published';
  form.publish_time = new Date().toISOString().slice(0, 16);
  previewUrl.value = '';

  if (isEdit.value && props.editId) {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/news/${props.editId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('获取新闻详情失败');
      const news = await res.json();

      form.title = news.title || '';
      form.summary = news.summary || '';
      form.content = news.content || '';
      form.category = news.category || categories[0];
      form.cover_image = news.cover_image || '';
      form.author = news.author || '编辑部';
      form.status = news.status || 'draft';
      form.publish_time = news.publish_time
        ? news.publish_time.slice(0, 16)
        : new Date().toISOString().slice(0, 16);
      if (form.cover_image) previewUrl.value = form.cover_image;
    } catch (err: any) {
      ElMessage.error(err.message);
      open.value = false;
    }
  }
});

// ── Image upload ──
async function onFileSelected() {
  const input = fileInputRef.value;
  if (!input?.files?.[0]) return;
  const file = input.files[0];

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    ElMessage.error('仅支持 jpg、png、webp 格式的图片');
    input.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 5MB');
    input.value = '';
    return;
  }

  uploadingCover.value = true;
  try {
    const result: any = await uploadImage(file);
    form.cover_image = result.url;
    previewUrl.value = result.url;
    ElMessage.success('图片上传成功');
  } catch (err: any) {
    ElMessage.error(err.message || '图片上传失败');
  } finally {
    uploadingCover.value = false;
  }
}

// ── Submit ──
async function handleSubmit() {
  if (!form.title.trim()) { ElMessage.warning('标题不能为空'); return; }
  if (!form.summary.trim()) { ElMessage.warning('摘要不能为空'); return; }
  if (!form.content.trim()) { ElMessage.warning('正文内容不能为空'); return; }

  submitLoading.value = true;
  try {
    const payload = { ...form };

    if (isEdit.value && props.editId) {
      await updateNews(props.editId!, payload);
      ElMessage.success('更新成功');
    } else {
      await createNews(payload);
      ElMessage.success('发布成功');
    }

    emit('saved');
    open.value = false;
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败');
  } finally {
    submitLoading.value = false;
  }
}

function handleClose() {
  open.value = false;
}

function removeCover() {
  previewUrl.value = '';
  form.cover_image = '';
}
</script>

<template>
  <el-dialog
    v-model="open"
    :title="titleText"
    width="720px"
    destroy-on-close
    @close="handleClose"
  >
    <el-form label-width="80px" class="news-form">
      <el-form-item label="标题" required>
        <el-input v-model="form.title" placeholder="请输入新闻标题" maxlength="200" />
      </el-form-item>

      <el-form-item label="分类" required>
        <el-select v-model="form.category" placeholder="请选择分类" style="width: 100%">
          <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
        </el-select>
      </el-form-item>

      <el-form-item label="摘要" required>
        <el-input
          v-model="form.summary"
          type="textarea"
          :rows="3"
          placeholder="请输入新闻摘要（显示在列表中）"
          maxlength="300"
        />
      </el-form-item>

      <el-form-item label="正文" required>
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="14"
          placeholder="请输入正文内容（支持 HTML 标签）"
        />
      </el-form-item>

      <el-form-item label="封面图片">
        <div class="cover-upload-area">
          <div v-if="previewUrl" class="cover-preview">
            <img :src="previewUrl" alt="封面预览" class="preview-img" />
            <el-button type="danger" text size="small" @click="removeCover">移除</el-button>
          </div>
          <div v-else class="cover-placeholder" @click="fileInputRef?.click()">
            <el-icon :size="24"><Picture /></el-icon>
            <span>点击上传</span>
            <span class="hint">jpg / png / webp，最大 5MB</span>
          </div>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style="display: none"
            @change="onFileSelected"
          />
          <el-button
            v-if="!previewUrl"
            :loading="uploadingCover"
            @click="fileInputRef?.click()"
          >选择图片</el-button>
        </div>
      </el-form-item>

      <el-form-item label="作者">
        <el-input v-model="form.author" placeholder="默认：编辑部" maxlength="50" />
      </el-form-item>

      <el-form-item label="发布时间">
        <el-date-picker
          v-model="form.publish_time"
          type="datetime"
          placeholder="选择发布时间"
          format="YYYY-MM-DD HH:mm"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="状态">
        <el-radio-group v-model="form.status">
          <el-radio value="published">发布</el-radio>
          <el-radio value="draft">草稿</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '发布' }}
        </el-button>
        <el-button @click="handleClose">取消</el-button>
      </el-form-item>
    </el-form>
  </el-dialog>
</template>

<style scoped>
.news-form { padding: 0 20px; }
.cover-upload-area { display: flex; align-items: center; gap: 12px; }
.cover-placeholder {
  width: 120px; height: 80px; border: 1px dashed #d1d5db;
  border-radius: 8px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
  color: #9ca3af; cursor: pointer; font-size: 12px;
  transition: border-color 0.2s, color 0.2s;
}
.cover-placeholder:hover { border-color: #29B6F6; color: #29B6F6; }
.hint { font-size: 10px; color: #d1d5db; }
.cover-preview {
  position: relative; width: 120px; height: 80px;
  border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;
}
.preview-img { width: 100%; height: 100%; object-fit: cover; }
</style>
