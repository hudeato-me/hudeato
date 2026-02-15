import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

interface UserSession {
  user: {
    id: string
    name: string
    email: string
    createdAt: string
    image?: string | null
  }
}

function DashboardPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const result = await authClient.getSession()
        if (!result.data?.user) {
          navigate({ to: '/login' })
          return
        }
        setSession(result.data as UserSession)
      } catch {
        navigate({ to: '/login' })
      } finally {
        setLoading(false)
      }
    }
    fetchSession()
  }, [navigate])

  const handleLogout = async () => {
    await authClient.signOut()
    navigate({ to: '/' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black/30 text-[0.95rem]">
        読み込み中...
      </div>
    )
  }

  if (!session) {
    return null
  }

  const user = session.user
  const createdDate = new Date(user.createdAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const stats = {
    words: 0,
    mastered: 0,
    streak: 0,
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between bg-white/90 backdrop-blur-xl border-b border-black/[0.06] max-sm:px-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="no-underline">
            <div className="text-xl font-extrabold tracking-tight bg-gradient-to-br from-[#1a1a2e] to-[#6c63ff] bg-clip-text text-transparent">
              Hudeato
            </div>
          </Link>
          <span className="text-sm text-black/30">
            こんにちは、{user.name || user.email.split('@')[0]}さん
          </span>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-full text-xs font-semibold border-[1.5px] border-black/10 bg-white text-black/40 cursor-pointer transition-all duration-200 font-[inherit] hover:border-red-500 hover:text-red-500 hover:bg-red-50"
          onClick={handleLogout}
        >
          ログアウト
        </button>
      </header>

      {/* Content */}
      <main className="max-w-[720px] mx-auto px-6 py-10 space-y-6 max-sm:px-4 max-sm:py-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">ダッシュボード</h1>
          <p className="text-black/30 text-[0.95rem]">
            学習の進捗状況を確認しましょう
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
          <div className="bg-black/[0.02] rounded-2xl p-6 border border-black/5">
            <div className="text-sm text-black/40 mb-1">Words</div>
            <div className="text-3xl">{stats.words}</div>
          </div>
          <div className="bg-black/[0.02] rounded-2xl p-6 border border-black/5">
            <div className="text-sm text-black/40 mb-1">Mastered</div>
            <div className="text-3xl">{stats.mastered}</div>
          </div>
          <div className="bg-black/[0.02] rounded-2xl p-6 border border-black/5">
            <div className="text-sm text-black/40 mb-1">Streak</div>
            <div className="text-3xl">{stats.streak}</div>
          </div>
        </div>

        {/* User Info */}
        <div className="bg-black/[0.02] rounded-2xl p-6 border border-black/5">
          <div className="text-xs font-semibold text-black/30 uppercase tracking-wider mb-4">
            アカウント情報
          </div>
          <div className="flex items-center justify-between py-3 border-b border-black/5">
            <span className="text-sm text-black/40">名前</span>
            <span className="text-sm font-semibold">{user.name || '未設定'}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-black/5">
            <span className="text-sm text-black/40">メール</span>
            <span className="text-sm font-semibold break-all">{user.email}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-black/5">
            <span className="text-sm text-black/40">ユーザーID</span>
            <span className="text-sm font-semibold break-all">{user.id}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-black/40">登録日</span>
            <span className="text-sm font-semibold">{createdDate}</span>
          </div>
        </div>

        {/* Activity */}
        <div className="bg-black/[0.02] rounded-2xl p-6 border border-black/5">
          <div className="text-xs font-semibold text-black/30 uppercase tracking-wider mb-4">
            最近のアクティビティ
          </div>
          <p className="text-black/25 text-sm py-4">
            まだアクティビティはありません。学習を始めましょう！
          </p>
        </div>
      </main>
    </div>
  )
}
