// 暂时完全禁用 middleware，避免 Edge Function 体积过大问题
// 如果需要认证保护，请在页面组件中单独实现

export function middleware() {
  // 不做任何事
  return undefined
}

export const config = {
  matcher: [],
}
