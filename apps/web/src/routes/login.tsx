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
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_30%_20%,rgba(108,99,255,0.06)_0%,transparent_50%),radial-gradient(ellipse_at_70%_80%,rgba(255,107,157,0.04)_0%,transparent_50%)] bg-[#fafbfc] p-6">
      <div className="w-full max-w-[420px] bg-white rounded-3xl p-8 shadow-[0_4px_30px_rgba(0,0,0,0.06)] border border-black/[0.06] animate-fade-in-up">
        <div className="text-2xl font-extrabold tracking-tight bg-gradient-to-br from-[#1a1a2e] to-[#6c63ff] bg-clip-text text-transparent text-center mb-2">
          Hudeato
        </div>
        <p className="text-center text-black/30 text-sm mb-6">
          {mode === 'login'
            ? 'アカウントにログイン'
            : '新しいアカウントを作成'}
        </p>

        <div className="flex bg-black/[0.04] rounded-xl p-1 mb-5">
          <button
            type="button"
            className={`flex-1 py-2 rounded-[10px] border-none text-sm font-semibold cursor-pointer transition-all duration-200 ${
              mode === 'login'
                ? 'bg-white text-[#1a1a2e] shadow-sm'
                : 'bg-transparent text-black/30'
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
            className={`flex-1 py-2 rounded-[10px] border-none text-sm font-semibold cursor-pointer transition-all duration-200 ${
              mode === 'signup'
                ? 'bg-white text-[#1a1a2e] shadow-sm'
                : 'bg-transparent text-black/30'
            }`}
            onClick={() => {
              setMode('signup')
              setError('')
            }}
          >
            サインアップ
          </button>
        </div>

        <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-xs font-semibold text-black/60">
                名前
              </label>
              <input
                id="name"
                type="text"
                placeholder="お名前"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-4 py-3 rounded-xl border-[1.5px] border-black/10 text-[0.95rem] font-[inherit] transition-all duration-200 bg-black/[0.02] focus:outline-none focus:border-[#6c63ff] focus:shadow-[0_0_0_3px_rgba(108,99,255,0.1)] focus:bg-white"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-black/60">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="px-4 py-3 rounded-xl border-[1.5px] border-black/10 text-[0.95rem] font-[inherit] transition-all duration-200 bg-black/[0.02] focus:outline-none focus:border-[#6c63ff] focus:shadow-[0_0_0_3px_rgba(108,99,255,0.1)] focus:bg-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-black/60">
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
              className="px-4 py-3 rounded-xl border-[1.5px] border-black/10 text-[0.95rem] font-[inherit] transition-all duration-200 bg-black/[0.02] focus:outline-none focus:border-[#6c63ff] focus:shadow-[0_0_0_3px_rgba(108,99,255,0.1)] focus:bg-white"
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-[10px] text-sm text-red-600 bg-red-50 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="py-3 rounded-xl border-none text-[0.95rem] font-semibold font-[inherit] bg-gradient-to-br from-[#6c63ff] to-[#5a52d5] text-white cursor-pointer transition-all duration-300 mt-2 shadow-[0_2px_12px_rgba(108,99,255,0.25)] hover:-translate-y-0.5 hover:shadow-[0_4px_18px_rgba(108,99,255,0.35)] disabled:opacity-65 disabled:cursor-not-allowed disabled:transform-none"
            disabled={loading}
          >
            {loading
              ? '処理中...'
              : mode === 'login'
                ? 'ログイン'
                : 'アカウントを作成'}
          </button>
        </form>

        <Link
          to="/"
          className="inline-flex items-center gap-1 text-black/30 no-underline text-sm mt-5 justify-center w-full transition-colors duration-200 hover:text-[#6c63ff]"
        >
          ← トップに戻る
        </Link>
      </div>
    </div>
  )
}
