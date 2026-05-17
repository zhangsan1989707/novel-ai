import { prisma } from './prisma'

const DEFAULT_USER = {
  id: '1',
  name: '开发用户',
  email: 'dev@localhost',
  image: null,
}

export async function auth(): Promise<{ user: { id: string; name: string | null; email: string | null; image: string | null } } | null> {
  try {
    let user = await prisma.user.findFirst()
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'dev@localhost',
          name: '开发用户',
          password: 'dev-password',
        },
      })
    }
    return {
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        image: (user as any).image || null,
      },
    }
  } catch {
    return {
      user: DEFAULT_USER,
    }
  }
}

export function getMockSession() {
  return {
    user: DEFAULT_USER,
  }
}

export const signIn = async () => {
  console.log('Sign in not implemented - using mock session')
}

export const signOut = async () => {
  console.log('Sign out not implemented - using mock session')
}

export const handlers = {
  GET: () => Response.json({}),
  POST: () => Response.json({}),
}

/**
 * 获取当前用户 ID（整数）
 * 当前为开发模式，固定返回 1
 * 后续接入认证系统后，从 session/token 获取真实用户 ID
 */
export function getCurrentUserId(): number {
  // TODO: 从 session/token 获取真实用户 ID
  return 1
}
