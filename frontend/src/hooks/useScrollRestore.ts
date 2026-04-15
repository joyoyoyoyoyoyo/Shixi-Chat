import { RefObject, useLayoutEffect, useEffect } from 'react'

// 模块级 Map：组件卸载后数据依然保留，直到整个网站被关闭
const scrollMap = new Map<string, number>()

/**
 * 保留页面滚动位置：
 * - useLayoutEffect 在浏览器绘制前恢复，用户不会看到闪烁
 * - scroll 事件实时保存，不依赖 ref 在 unmount 时是否有效
 */
export function useScrollRestore(key: string, ref: RefObject<HTMLElement | null>) {
  // 挂载时立刻恢复（绘制前执行，无闪烁）
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const saved = scrollMap.get(key)
    if (saved !== undefined) {
      el.scrollTop = saved
    }
  // 只在挂载时执行一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 实时监听滚动，持续保存位置
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const save = () => scrollMap.set(key, el.scrollTop)
    el.addEventListener('scroll', save, { passive: true })
    return () => el.removeEventListener('scroll', save)
  }, [key])
}
