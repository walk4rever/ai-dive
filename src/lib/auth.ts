import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyPassword } from '@/lib/auth/password'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const supabase = await createServiceClient()
        const { data: user } = await supabase
          .from('ai_pulse_users')
          .select('id, email, role, password_hash, email_verified_at')
          .eq('email', credentials.email)
          .single()

        // Constant-time: always verify even if user not found (use dummy hash)
        const storedHash = user?.password_hash ?? 'pbkdf2:100000:dummy:dummy'
        const valid = verifyPassword(credentials.password, storedHash)

        if (!user || !valid || !user.email_verified_at) return null

        return { id: user.id, email: user.email, role: user.role }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
      }
      return session
    },
  },
}
