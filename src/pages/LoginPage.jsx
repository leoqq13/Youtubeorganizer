import { useState } from 'react'
import { useAuth } from '../lib/auth'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { signUp, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [busy, setBusy] = useState(false)

  const go = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (isSignUp) { await signUp(email, password); toast.success('Account created!') }
      else { await signIn(email, password); toast.success('Welcome back!') }
    } catch (err) { toast.error(err.message) }
    setBusy(false)
  }

  const inp = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--text)', fontSize: 16, outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at 50% 40%, #201e48, var(--bg) 72%)' }}>
      <div style={{ width: 400, maxWidth: '90vw', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, margin: '0 auto 14px', background: 'linear-gradient(135deg, var(--accent), #e050fb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff' }}>▶</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>TubeFlow</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 28 }}>YouTube Content Planner</p>
        <form onSubmit={go} style={{ padding: 24, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'left' }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-soft)', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={{ ...inp, marginBottom: 14 }} />
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-soft)', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required style={inp} />
          <button type="submit" disabled={busy} style={{ width: '100%', marginTop: 16, padding: 13, background: busy ? 'var(--border)' : 'linear-gradient(135deg, var(--accent), #6840e0)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 16, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
          <p style={{ marginTop: 14, fontSize: 14, color: 'var(--text-dim)', textAlign: 'center' }}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <span onClick={() => setIsSignUp(!isSignUp)} style={{ color: 'var(--accent-soft)', cursor: 'pointer', fontWeight: 600 }}>{isSignUp ? 'Sign In' : 'Sign Up'}</span>
          </p>
        </form>
      </div>
    </div>
  )
}
