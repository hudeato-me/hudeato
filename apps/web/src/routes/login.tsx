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
          name: undefined, // signInにはnameは不要ですが型定義によっては必要な場合も考慮
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
    // 背景: LPに合わせた白ベース + 僅かなグラデーション
    <div className="min-h-screen flex items-center justify-center bg-white font-sans text-slate-700 selection:bg-slate-100 p-6 relative overflow-hidden">
      
      {/* 装飾的な背景要素（LPの雰囲気を踏襲） */}
      <div className="absolute top-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-slate-100/50 blur-3xl" />
      <div className="absolute bottom-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-slate-50/80 blur-3xl" />

      {/* ログインカード (Glassmorphism) */}
      <div className="w-full max-w-[400px] relative z-10 rounded-3xl border border-white/40 bg-white/60 p-8 shadow-xl backdrop-blur-xl ring-1 ring-black/5 animate-fade-in-up">
        
        {/* ロゴエリア */}
        <div className="mb-8 flex flex-col items-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
                hudeato.me
            </h1>
        </div>

        {/* タブ切り替え */}
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
            新規登録
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
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200"
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
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-slate-500 ml-1">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200"
            />
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
                : 'はじめる'}
          </button>
        </form>

        <div className="mt-8 text-center">
            <Link
                to="/"
                className="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-600 border-b border-transparent hover:border-slate-300 pb-0.5"
            >
            トップに戻る
            </Link>
        </div>
      </div>
    </div>
  )
}