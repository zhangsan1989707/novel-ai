// 暂时简化 middleware 避免 Edge Function 体积过大问题
export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: [], // 暂时完全禁用 middleware
}
