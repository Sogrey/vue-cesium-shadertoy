/**
 * ShaderToy API 工具
 * API 文档: https://www.shadertoy.com/api
 */

// API Key 存储 key
const API_KEY_STORAGE = 'shadertoy_api_key'

// 默认公开 API Key（ShaderToy 提供的演示 key）
const DEFAULT_API_KEY = 'fd8'

/**
 * 获取存储的 API Key
 */
export function getApiKey(): string {
  const storedKey = localStorage.getItem(API_KEY_STORAGE)
  return storedKey || DEFAULT_API_KEY
}

/**
 * 保存 API Key
 */
export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key)
}

/**
 * 清除 API Key
 */
export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE)
}

/**
 * Shader 信息接口
 */
export interface ShaderInfo {
  id: string
  name: string
  author: string
  description: string
  code: string
  tags: string[]
}

/**
 * 从 ShaderToy API 获取 Shader 信息
 */
export async function fetchShaderById(shaderId: string): Promise<ShaderInfo> {
  const apiKey = getApiKey()
  
  // 使用代理路径（开发环境）或直接访问（生产环境需要配置 CORS）
  const isDev = import.meta.env.DEV
  const baseUrl = isDev ? '/api/shadertoy' : 'https://www.shadertoy.com/api/v1'
  const url = `${baseUrl}/shaders/${shaderId}?key=${apiKey}`
  
  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.Error) {
      throw new Error(data.Error)
    }
    
    // 解析返回数据
    const shader = data.Shader
    
    if (!shader) {
      throw new Error('未找到该 Shader')
    }
    
    // 提取代码
    const renderpasses = shader.renderpass
    if (!renderpasses || renderpasses.length === 0) {
      throw new Error('该 Shader 没有渲染通道')
    }
    
    // 通常使用第一个 renderpass 的代码
    const code = renderpasses[0].code
    
    return {
      id: shader.info.id,
      name: shader.info.name,
      author: shader.info.username,
      description: shader.info.description,
      code: code,
      tags: shader.info.tags || [],
    }
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('网络请求失败。如果是生产环境，请确保配置了 CORS 代理。')
    }
    throw error
  }
}

/**
 * 从 ShaderToy URL 提取 Shader ID
 */
export function extractShaderId(url: string): string | null {
  // 匹配 https://www.shadertoy.com/view/XXXXXX
  const match = url.match(/shadertoy\.com\/view\/([a-zA-Z0-9]+)/)
  if (match && match[1]) {
    return match[1]
  }
  
  // 如果直接是 ID (6位字母数字)
  if (/^[a-zA-Z0-9]{6}$/.test(url)) {
    return url
  }
  
  return null
}
