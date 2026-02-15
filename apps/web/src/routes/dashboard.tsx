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
    return <div className="dashboard-loading">読み込み中...</div>
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

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <div className="dashboard-logo">Hudeato</div>
          </Link>
          <span className="dashboard-greeting">
            こんにちは、{user.name || user.email.split('@')[0]}さん
          </span>
        </div>
        <button
          type="button"
          className="dashboard-logout-btn"
          onClick={handleLogout}
        >
          ログアウト
        </button>
      </header>

      {/* Content */}
      <main className="dashboard-content">
        <h1 className="dashboard-title">ダッシュボード</h1>
        <p className="dashboard-subtitle">
          学習の進捗状況を確認しましょう
        </p>

        {/* Stats */}
        <div className="dashboard-stats">
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-value">0</div>
            <div className="dashboard-stat-label">Words</div>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-value">0</div>
            <div className="dashboard-stat-label">Mastered</div>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-value">0</div>
            <div className="dashboard-stat-label">Streak</div>
          </div>
        </div>

        {/* User Info */}
        <div className="dashboard-card">
          <div className="dashboard-card-title">アカウント情報</div>
          <div className="dashboard-info-row">
            <span className="dashboard-info-label">名前</span>
            <span className="dashboard-info-value">
              {user.name || '未設定'}
            </span>
          </div>
          <div className="dashboard-info-row">
            <span className="dashboard-info-label">メール</span>
            <span className="dashboard-info-value">{user.email}</span>
          </div>
          <div className="dashboard-info-row">
            <span className="dashboard-info-label">ユーザーID</span>
            <span className="dashboard-info-value">{user.id}</span>
          </div>
          <div className="dashboard-info-row">
            <span className="dashboard-info-label">登録日</span>
            <span className="dashboard-info-value">{createdDate}</span>
          </div>
        </div>

        {/* Placeholder activity */}
        <div className="dashboard-card">
          <div className="dashboard-card-title">最近のアクティビティ</div>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', padding: '1rem 0' }}>
            まだアクティビティはありません。学習を始めましょう！
          </p>
        </div>
      </main>
    </div>
  )
}
