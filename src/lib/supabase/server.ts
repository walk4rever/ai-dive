import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseEnv } from './env'

const fetchWithTimeout: typeof fetch = (input, init) => {
  const signal = init?.signal ?? AbortSignal.timeout(15000)
  return fetch(input, { ...init, signal })
}

export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey, hasPublicEnv } = getSupabaseEnv()

  if (!hasPublicEnv || !url || !anonKey) {
    throw new Error(
      'Supabase public env is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
    )
  }

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
      global: {
        fetch: fetchWithTimeout,
      },
    }
  )
}

export async function createServiceClient() {
  const cookieStore = await cookies()
  const { url, serviceRoleKey, hasServiceRoleEnv } = getSupabaseEnv()

  if (!hasServiceRoleEnv || !url || !serviceRoleKey) {
    throw new Error(
      'Supabase service env is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.'
    )
  }

  return createServerClient(
    url,
    serviceRoleKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
      global: {
        fetch: fetchWithTimeout,
      },
    }
  )
}
