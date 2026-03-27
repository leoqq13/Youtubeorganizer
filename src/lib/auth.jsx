import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 4000) // never hang

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => { clearTimeout(timer); subscription.unsubscribe() }
  }, [])

  async function loadProfile(userId) {
    try {
      let { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (!data) {
        await new Promise(r => setTimeout(r, 1500))
        const res = await supabase.from('profiles').select('*').eq('id', userId).single()
        data = res.data
      }
      if (!data) {
        await supabase.auth.signOut()
        setUser(null)
      } else {
        setProfile(data)
      }
    } catch {
      try { await supabase.auth.signOut() } catch {}
      setUser(null)
    }
    setLoading(false)
  }

  const signUp = async (email, pw) => {
    const { error } = await supabase.auth.signUp({ email, password: pw })
    if (error) throw error
  }
  const signIn = async (email, pw) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) throw error
  }
  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, loadProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
