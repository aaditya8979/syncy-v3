import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Disc3, Loader2, AlertCircle, Music2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'signup'

export const Login = () => {
  const navigate = useNavigate()
  const { loginAnon, loginEmail, registerEmail, loading } = useAuth()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'login') await loginEmail(email, password)
      else await registerEmail(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSubmitting(false) }
  }

  const handleAnon = async () => {
    setError('')
    setSubmitting(true)
    try {
      await loginAnon()
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="h-screen bg-s-bg overflow-hidden flex items-center justify-center relative">
      {/* Bg */}
      <div className="absolute inset-0 bg-grid-fine bg-grid opacity-100" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-s-violet/8 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-s-indigo/5 rounded-full blur-[100px]" />

      {/* Rotating disc decoration */}
      <div className="absolute left-1/4 top-1/2 -translate-y-1/2 -translate-x-full opacity-10">
        <div className="disc-outer disc-grooves w-[400px] h-[400px] animate-spin-disc-slow" />
      </div>
      <div className="absolute right-1/4 top-1/2 -translate-y-1/2 translate-x-full opacity-5">
        <div className="disc-outer disc-grooves w-[250px] h-[250px] animate-spin-disc" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-[360px] px-4"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="w-16 h-16 disc-outer flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-s-violet flex items-center justify-center z-10">
                <Music2 size={20} className="text-white" />
              </div>
            </div>
          </div>
          <h1 className="font-display font-bold text-3xl tracking-tight text-gradient">Syncy</h1>
          <p className="text-s-sub text-sm mt-1.5">Real-time synchronized music</p>
        </div>

        {/* Card */}
        <div className="bg-s-card border border-s-border rounded-2xl p-6 shadow-card backdrop-blur-xl">
          {/* Mode tabs */}
          <div className="flex gap-1 bg-s-deep rounded-xl p-1 mb-5">
            {(['login', 'signup'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize',
                  mode === m ? 'bg-s-card text-s-text shadow' : 'text-s-muted hover:text-s-sub'
                )}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handle} className="space-y-4">
            {[
              { id: 'email', label: 'Email', type: 'email', value: email, setter: setEmail, placeholder: 'you@example.com' },
              { id: 'password', label: 'Password', type: 'password', value: password, setter: setPassword, placeholder: '••••••••', minLength: 6 },
            ].map(f => (
              <div key={f.id}>
                <label htmlFor={f.id} className="block text-xs font-medium text-s-sub mb-1.5">{f.label}</label>
                <input
                  id={f.id}
                  type={f.type}
                  value={f.value}
                  onChange={e => f.setter(e.target.value)}
                  required
                  placeholder={f.placeholder}
                  minLength={f.minLength}
                  className="w-full px-3.5 py-2.5 bg-s-deep border border-s-border rounded-xl text-sm text-s-text placeholder-s-muted/50 focus:outline-none focus:border-s-violet/60 transition-colors"
                />
              </div>
            ))}

            {error && (
              <div className="flex items-start gap-2 text-red-400 bg-red-400/8 border border-red-400/20 rounded-xl px-3 py-2.5 text-xs">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full py-2.5 bg-s-violet hover:bg-s-violet/90 text-white font-medium text-sm rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-s-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-s-card px-3 text-xs text-s-muted">or</span>
            </div>
          </div>

          <button
            onClick={handleAnon}
            disabled={submitting || loading}
            className="w-full py-2.5 bg-s-surface border border-s-border hover:border-s-violet/30 text-s-text font-medium text-sm rounded-xl transition-all disabled:opacity-50 active:scale-98"
          >
            Continue as Guest
          </button>
        </div>

        <p className="text-center text-xs text-s-muted mt-4">
          Free music · JioSaavn · Jamendo · YouTube
        </p>
      </motion.div>
    </div>
  )
}
