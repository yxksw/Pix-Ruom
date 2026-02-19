import { BaseStorage } from './BaseStorage'

/**
 * Telegram Bot 存储适配器
 * 利用 Telegram Bot API 作为文件存储后端
 */
export class TelegramStorage extends BaseStorage {
  /**
   * @param {Object} config - Telegram配置
   * @param {string} config.botToken - Telegram Bot Token
   * @param {string} config.chatId - Telegram Chat ID (频道或群组ID)
   * @param {string} [config.proxyUrl] - 可选的代理域名
   */
  constructor(config) {
    super(config)
    
    this.botToken = config.botToken
    this.chatId = config.chatId
    this.proxyUrl = config.proxyUrl || ''
    
    // 如果设置了代理域名，使用代理域名，否则使用官方 API
    const apiDomain = this.proxyUrl ? `https://${this.proxyUrl}` : 'https://api.telegram.org'
    this.baseURL = `${apiDomain}/bot${this.botToken}`
    this.fileDomain = this.proxyUrl ? `https://${this.proxyUrl}` : 'https://api.telegram.org'
    
    this.defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    // 本地存储键名
    this.storageKey = 'telegram_upload_index'
  }
  
  /**
   * 获取本地文件索引
   * @private
   */
  _getLocalIndex() {
    try {
      const data = localStorage.getItem(this.storageKey)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }
  
  /**
   * 保存本地文件索引
   * @private
   */
  _saveLocalIndex(index) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(index))
    } catch (error) {
      console.error('Failed to save local index:', error)
    }
  }

  /**
   * 上传文件到 Telegram
   * @param {File} file - 文件对象
   * @returns {Promise<{url: string, key: string}>}
   */
  async upload(file) {
    try {
      const key = this.fileManager.generatePath(file.name)
      
      // 根据文件类型选择发送接口
      const sendFunction = this._getSendFunction(file.type, file.name)
      
      // 发送文件到 Telegram
      const formData = new FormData()
      formData.append('chat_id', this.chatId)
      formData.append(sendFunction.type, file, file.name)

      const response = await fetch(`${this.baseURL}/${sendFunction.url}`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Telegram API error: ${response.status} ${errorText}`)
      }

      const responseData = await response.json()
      
      if (!responseData.ok) {
        throw new Error(`Telegram API error: ${responseData.description}`)
      }

      // 获取文件信息
      const fileInfo = this._getFileInfo(responseData)
      if (!fileInfo) {
        throw new Error('Failed to get file info from Telegram response')
      }

      // 获取文件路径
      const filePath = await this._getFilePath(fileInfo.file_id)
      if (!filePath) {
        throw new Error('Failed to get file path from Telegram')
      }

      // 生成访问 URL
      const url = `${this.fileDomain}/file/bot${this.botToken}/${filePath}`
      
      // 保存到本地索引
      const index = this._getLocalIndex()
      index.push({
        key,
        url,
        fileId: fileInfo.file_id,
        filePath,
        lastModified: new Date().toISOString(),
        size: fileInfo.file_size || 0
      })
      this._saveLocalIndex(index)

      return { url, key, fileId: fileInfo.file_id, filePath }
    } catch (error) {
      this._handleError(error, '上传')
    }
  }

  /**
   * 删除文件
   * 从本地索引中移除（Telegram Bot API 不支持删除消息中的文件）
   * @param {string} key - 文件标识符
   */
  async delete(key) {
    // Telegram Bot API 不支持删除已发送的文件/消息
    // 只能从本地索引中移除
    const index = this._getLocalIndex()
    const newIndex = index.filter(item => item.key !== key)
    this._saveLocalIndex(newIndex)
    console.warn('Telegram storage: removed from local index only (Bot API does not support deletion)')
    return Promise.resolve()
  }

  /**
   * 获取文件列表
   * 从本地索引中读取
   */
  async listObjects(prefix = '') {
    const index = this._getLocalIndex()
    
    // 如果有前缀，过滤匹配的文件
    const filtered = prefix 
      ? index.filter(item => item.key.startsWith(prefix))
      : index
    
    // 按时间降序排序
    return filtered
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
      .map(item => ({
        key: item.key,
        url: item.url,
        lastModified: new Date(item.lastModified),
        size: item.size
      }))
  }

  /**
   * 测试连接
   * 通过调用 getMe 接口验证 Bot Token 是否有效
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.baseURL}/getMe`, {
        method: 'GET',
        headers: this.defaultHeaders
      })

      const data = await response.json()
      
      if (data.ok) {
        return this._formatTestResult(true)
      } else {
        return this._formatTestResult(false, data.description || 'Invalid bot token')
      }
    } catch (error) {
      return this._formatTestResult(false, this._parseError(error))
    }
  }

  /**
   * 根据文件类型获取发送接口
   * @private
   */
  _getSendFunction(fileType, fileName) {
    const ext = fileName.split('.').pop().toLowerCase()
    
    // GIF 和 WEBP 特殊处理，避免被转换
    if (ext === 'gif' || ext === 'webp' || fileType === 'image/gif') {
      return { url: 'sendAnimation', type: 'animation' }
    }
    
    // SVG 和 ICO 作为文档发送
    if (fileType === 'image/svg+xml' || fileType === 'image/x-icon') {
      return { url: 'sendDocument', type: 'document' }
    }

    // 根据 MIME 类型选择接口
    if (fileType.startsWith('image/')) {
      return { url: 'sendPhoto', type: 'photo' }
    }
    
    if (fileType.startsWith('video/')) {
      return { url: 'sendVideo', type: 'video' }
    }
    
    if (fileType.startsWith('audio/')) {
      return { url: 'sendAudio', type: 'audio' }
    }

    // 默认作为文档发送
    return { url: 'sendDocument', type: 'document' }
  }

  /**
   * 从响应中提取文件信息
   * @private
   */
  _getFileInfo(responseData) {
    const getFileDetails = (file) => ({
      file_id: file.file_id,
      file_name: file.file_name || file.file_unique_id,
      file_size: file.file_size,
    })

    try {
      if (!responseData.ok) {
        return null
      }

      const result = responseData.result

      if (result.photo) {
        // 获取最大尺寸的图片
        const largestPhoto = result.photo.reduce((prev, current) =>
          (prev.file_size > current.file_size) ? prev : current
        )
        return getFileDetails(largestPhoto)
      }

      if (result.video) {
        return getFileDetails(result.video)
      }

      if (result.audio) {
        return getFileDetails(result.audio)
      }

      if (result.document) {
        return getFileDetails(result.document)
      }

      if (result.animation) {
        return getFileDetails(result.animation)
      }

      return null
    } catch (error) {
      console.error('Error parsing Telegram response:', error.message)
      return null
    }
  }

  /**
   * 获取文件路径
   * @private
   */
  async _getFilePath(fileId) {
    try {
      const url = `${this.baseURL}/getFile?file_id=${fileId}`
      const response = await fetch(url, {
        method: 'GET',
        headers: this.defaultHeaders,
      })

      const responseData = await response.json()
      if (responseData.ok) {
        return responseData.result.file_path
      } else {
        return null
      }
    } catch (error) {
      console.error('Error getting file path:', error.message)
      return null
    }
  }

  /**
   * 获取文件内容
   * @param {string} fileId - 文件ID
   * @returns {Promise<Response>}
   */
  async getFileContent(fileId) {
    const filePath = await this._getFilePath(fileId)
    if (!filePath) {
      throw new Error(`File path not found for fileId: ${fileId}`)
    }

    const fullURL = `${this.fileDomain}/file/bot${this.botToken}/${filePath}`
    const response = await fetch(fullURL, {
      headers: this.defaultHeaders
    })

    return response
  }

  _parseError(error) {
    const message = error.message || ''
    
    if (message.includes('Unauthorized')) {
      return 'Bot Token 无效或已过期'
    }
    if (message.includes('chat not found')) {
      return 'Chat ID 无效或 Bot 未加入该频道/群组'
    }
    if (message.includes('bot was kicked')) {
      return 'Bot 已被踢出该频道/群组'
    }
    if (message.includes('not enough rights')) {
      return 'Bot 没有发送消息的权限'
    }
    if (message.includes('file is too big')) {
      return '文件大小超过 Telegram 限制 (20MB)'
    }
    if (message.includes('NetworkError') || message.includes('fetch')) {
      return '网络连接失败，请检查网络或代理配置'
    }
    
    return message || '未知错误'
  }
}
