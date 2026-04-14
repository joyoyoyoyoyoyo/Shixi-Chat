// 当前登录用户 ID，由登录/登出时设置
let _userId: string | null = null

export const getCurrentUserId = () => _userId

export function setCurrentUserId(id: string | null) {
  _userId = id
}

/**
 * Zustand persist 自定义 storage 适配器。
 * 存储 key 格式为 `{name}:{userId}`，不同用户完全隔离。
 * 未登录时（_userId 为 null）不读写，让 store 保持初始状态。
 */
export const userAwareStorage = {
  getItem: (name: string): string | null => {
    if (!_userId) return null
    return localStorage.getItem(`${name}:${_userId}`)
  },
  setItem: (name: string, value: string): void => {
    if (!_userId) return
    localStorage.setItem(`${name}:${_userId}`, value)
  },
  removeItem: (name: string): void => {
    if (!_userId) return
    localStorage.removeItem(`${name}:${_userId}`)
  },
}
