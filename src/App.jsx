import { AuthProvider, useAuth } from './lib/auth'
import { Toaster } from 'react-hot-toast'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'

function Router() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-dim)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, margin: '0 auto 12px', background: 'linear-gradient(135deg,var(--accent),#e050fb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff' }}>▶</div>
        Loading...
      </div>
    </div>
  )
  return user ? <Dashboard /> : <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1c1c40', color: '#eae6f4', border: '1px solid #2c2c5c', borderRadius: 10, fontSize: 14 } }} />
      <Router />
    </AuthProvider>
  )
}
