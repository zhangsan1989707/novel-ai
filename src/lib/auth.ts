import { prisma } from './prisma'
import { cookies } from 'next/headers'

const DEFAULT_USER = {
  id: '1',
  name: '开发用户',
  email: 'dev@localhost',
  image: null,
}

const SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  'next-auth.session-token',
  '__Secure-authjs.session-token',
  '__Secure-next-auth.session-token',
]

function isProductionLike() {
  return process.env.NODE_ENV === 'production' || process.env.AUTH_ENFORCE === 'true'
}

async function resolveSessionUserId(sessionToken: string | undefined | null): Promise<number | null> {
  if (!sessionToken) {
    return null
  }

  try {
    const session = await prisma.session.findFirst({
      where: {
        sessionToken,
        expires: { gt: new Date() },
      },
      select: { userId: true },
    })

    return session?.userId ?? null
  } catch {
    return null
  }
}

function readSessionTokenFromCookies(cookieStore: { get(name: string): { value?: string } | undefined }): string | undefined {
  for (const name of SESSION_COOKIE_NAMES) {
    const value = cookieStore.get(name)?.value
    if (value) {
      return value
    }
  }

  return undefined
}

export async function auth(): Promise<{ user: { id: string; name: string | null; email: string | null; image: string | null } } | null> {
  try {
    let userId: number | null = null

    try {
      const cookieStore = await cookies()
      const sessionToken = readSessionTokenFromCookies(cookieStore)
      userId = await resolveSessionUserId(sessionToken)
    } catch {
      // 在 Route Handler 等无法直接读取 cookie 的场景下保持兼容
    }

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        return null
      }

      return {
        user: {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          image: (user as { image?: string | null }).image || null,
        },
      }
    }

    // 无 session 时自动使用默认用户（系统不需要登录）
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
        image: (user as { image?: string | null }).image || null,
      },
    }
  } catch {
    return { user: DEFAULT_USER }
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

export async function resolveCurrentUserId(): Promise<number> {
  const session = await auth()
  if (session?.user?.id) {
    return Number(session.user.id)
  }

  return 1
}

export async function getCurrentUserId(): Promise<number> {
  return resolveCurrentUserId()
}
