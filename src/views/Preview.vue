<template>
  <div class="preview-container">
    <div class="preview-header">
      <el-button type="primary" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <h2 class="preview-title">文件预览</h2>
    </div>
    
    <div class="preview-content">
      <div v-if="loading" class="loading-container">
        <el-icon class="is-loading"><Loading /></el-icon>
        <p>加载中...</p>
      </div>
      
      <div v-else-if="error" class="error-container">
        <el-icon><CircleClose /></el-icon>
        <p>{{ error }}</p>
        <el-button type="primary" @click="loadFile">重新加载</el-button>
      </div>
      
      <div v-else class="file-preview">
        <!-- 图片预览 -->
        <img 
          v-if="isImage" 
          :src="fileUrl" 
          class="image-preview"
          @load="onLoad"
          @error="onError"
        />
        
        <!-- 视频预览 -->
        <video 
          v-else-if="isVideo" 
          :src="fileUrl" 
          class="video-preview"
          controls
          @loadstart="loading = true"
          @loadeddata="loading = false"
          @error="onError"
        />
        
        <!-- 音频预览 -->
        <audio 
          v-else-if="isAudio" 
          :src="fileUrl" 
          class="audio-preview"
          controls
          @loadstart="loading = true"
          @loadeddata="loading = false"
          @error="onError"
        />
        
        <!-- 其他文件类型 -->
        <div v-else class="other-preview">
          <el-icon><Document /></el-icon>
          <p>无法直接预览此文件类型</p>
          <el-button type="primary" @click="downloadFile">
            <el-icon><Download /></el-icon>
            下载文件
          </el-button>
        </div>
      </div>
      
      <div class="file-info">
        <p><strong>文件名:</strong> {{ fileName }}</p>
        <p><strong>文件类型:</strong> {{ fileType }}</p>
        <p><strong>文件大小:</strong> {{ formatFileSize(size) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const fileUrl = ref('')
const fileName = ref('')
const fileType = ref('')
const size = ref(0)
const loading = ref(true)
const error = ref('')

// 计算属性
const isImage = computed(() => {
  return fileType.value.startsWith('image/')
})

const isVideo = computed(() => {
  return fileType.value.startsWith('video/')
})

const isAudio = computed(() => {
  return fileType.value.startsWith('audio/')
})

// 方法
const goBack = () => {
  router.back()
}

const loadFile = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // 从路由参数获取信息
    const url = route.query.url
    const name = route.query.name || 'unknown'
    const type = route.query.type || 'application/octet-stream'
    const fileSize = route.query.size || 0
    
    if (!url) {
      throw new Error('缺少文件URL')
    }
    
    fileUrl.value = url
    fileName.value = name
    fileType.value = type
    size.value = parseInt(fileSize)
    
    // 对于图片，预加载以检测错误
    if (isImage.value) {
      const img = new Image()
      img.onload = () => {
        loading.value = false
      }
      img.onerror = () => {
        loading.value = false
        error.value = '图片加载失败'
      }
      img.src = url
    } else {
      loading.value = false
    }
  } catch (err) {
    error.value = err.message
    loading.value = false
  }
}

const onLoad = () => {
  loading.value = false
}

const onError = () => {
  loading.value = false
  error.value = '文件加载失败'
}

const downloadFile = () => {
  // 创建下载链接
  const link = document.createElement('a')
  link.href = fileUrl.value
  link.download = fileName.value
  link.click()
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 生命周期
onMounted(loadFile)
</script>

<style scoped>
.preview-container {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

.preview-header {
  background: var(--el-bg-color);
  padding: 16px 24px;
  box-shadow: var(--el-box-shadow-lighter);
  display: flex;
  align-items: center;
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.preview-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.preview-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
}

.loading-container .el-icon {
  font-size: 48px;
  color: var(--el-color-primary);
  animation: rotate 2s linear infinite;
}

.error-container .el-icon {
  font-size: 48px;
  color: var(--el-color-danger);
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.file-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  background: var(--el-bg-color);
  padding: 48px;
  border-radius: 12px;
  box-shadow: var(--el-box-shadow-lighter);
}

.image-preview {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 8px;
}

.video-preview {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 8px;
}

.audio-preview {
  width: 100%;
  max-width: 600px;
}

.other-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 64px;
  background: var(--el-color-primary-light-9);
  border-radius: 12px;
}

.other-preview .el-icon {
  font-size: 64px;
  color: var(--el-color-primary);
  opacity: 0.5;
}

.file-info {
  background: var(--el-bg-color);
  padding: 24px;
  border-radius: 12px;
  box-shadow: var(--el-box-shadow-lighter);
  font-size: 14px;
  line-height: 1.6;
}

.file-info p {
  margin: 8px 0;
}

@media screen and (max-width: 768px) {
  .preview-content {
    padding: 16px;
  }
  
  .file-preview {
    padding: 24px;
  }
  
  .image-preview,
  .video-preview {
    max-height: 60vh;
  }
}
</style>
