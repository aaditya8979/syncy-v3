import { useState, useEffect } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, signInAnon, signInEmail, signUpEmail, signOut as sbSignOut } from '@/services/supabaseClient'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  })

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session, loading: false })
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, session, loading: false })
    })

    return () => subscription.unsubscribe()
  }, [])

  const loginAnon = async () => {
    setState(s => ({ ...s, loading: true }))
    const { error } = await signInAnon()
    if (error) { setState(s => ({ ...s, loading: false })); throw error }
  }

  const loginEmail = async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true }))
    const { error } = await signInEmail(email, password)
    if (error) { setState(s => ({ ...s, loading: false })); throw error }
  }

  const registerEmail = async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true }))
    const { error } = await signUpEmail(email, password)
    if (error) { setState(s => ({ ...s, loading: false })); throw error }
  }

  const logout = async () => {
    await sbSignOut()
  }

  const username = state.user?.email?.split('@')[0] || state.user?.id?.slice(0, 8) || 'Guest'

  return {
    user: state.user,
    session: state.session,
    loading: state.loading,
    username,
    isAuthenticated: !!state.user,
    loginAnon,
    loginEmail,
    registerEmail,
    logout,
  }
}
