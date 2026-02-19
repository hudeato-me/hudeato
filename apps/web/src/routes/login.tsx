import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const result = await authClient.signUp.email({
          email,
          password,
          name: name || email.split('@')[0],
        })
        if (result.error) {
          setError(result.error.message || 'サインアップに失敗しました')
          setLoading(false)
          return
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        })
        if (result.error) {
          setError(result.error.message || 'ログインに失敗しました')
          setLoading(false)
          return
        }
      }
      navigate({ to: '/dashboard' })
    } catch (err) {
      setError('エラーが発生しました。もう一度お試しください。')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white font-sans text-slate-700 selection:bg-slate-100 p-6 relative overflow-hidden">
      
      <div className="absolute top-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-slate-100/50 blur-3xl" />
      <div className="absolute bottom-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-slate-50/80 blur-3xl" />

      {/* ログインカード */}
      <div className="w-full max-w-[400px] relative z-10 rounded-3xl border border-white/40 bg-white/60 p-8 shadow-xl backdrop-blur-xl ring-1 ring-black/5 animate-fade-in-up">
        
        <div className="mb-8 flex flex-col items-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
                hudeato.me
            </h1>
        </div>

        {/* タブ */}
        <div className="flex bg-slate-100/50 rounded-full p-1 mb-8 border border-slate-200/50">
          <button
            type="button"
            className={`flex-1 py-2 rounded-full text-xs font-medium transition-all duration-300 ${
              mode === 'login'
                ? 'bg-white text-slate-800 shadow-sm ring-1 ring-black/5'
                : 'bg-transparent text-slate-400 hover:text-slate-600'
            }`}
            onClick={() => {
              setMode('login')
              setError('')
            }}
          >
            ログイン
          </button>
          <button
            type="button"
            className={`flex-1 py-2 rounded-full text-xs font-medium transition-all duration-300 ${
              mode === 'signup'
                ? 'bg-white text-slate-800 shadow-sm ring-1 ring-black/5'
                : 'bg-transparent text-slate-400 hover:text-slate-600'
            }`}
            onClick={() => {
              setMode('signup')
              setError('')
            }}
          >
            サインアップ
          </button>
        </div>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-xs font-semibold text-slate-500 ml-1">
                名前
              </label>
              <input
                id="name"
                type="text"
                placeholder="お名前"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-100 transition-all duration-200"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-slate-500 ml-1">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white/50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-100 transition-all duration-200"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-slate-500 ml-1">
              パスワード
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder=""
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white/50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-100 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label={showPassword ? "非表示" : "表示"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl text-xs font-medium text-red-600 bg-red-50 border border-red-100 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
            </div>
          )}

          <button
            type="submit"
            className="mt-2 w-full py-3 rounded-full border border-slate-300 bg-slate-800 text-sm font-medium text-white transition-all duration-300 hover:bg-slate-700 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading
              ? '処理中...'
              : mode === 'login'
                ? 'ログイン'
                : 'サインアップ'}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              // Google login処理はここに実装予定
            }}
            className="mt-1 w-full py-3 rounded-full border border-blue-400 bg-white text-sm font-medium text-slate-800 transition-all duration-300 hover:bg-slate-50 hover:shadow-lg flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {mode === 'login' ? 'Googleでログイン' : 'Googleでサインアップ'}
          </button>
        </form>

        <div className="mt-8 text-center">
            <Link
                to="/"
                className="inline-flex items-center gap-1 text-s text-slate-600 transition-colors hover:text-slate-800 border-b border-transparent hover:border-slate-300 pb-0.5"
            >
            戻る
            </Link>
        </div>
      </div>
    </div>
  )
}