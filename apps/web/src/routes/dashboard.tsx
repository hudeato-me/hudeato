import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Activity } from '~/components/dashboard/Activity'
import { Footer } from '~/components/Footer'
import { Header } from '~/components/Header'
import { RecentWordItem } from '~/components/dashboard/RecentWordItem'
import { StatCard } from '~/components/dashboard/StatCard'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

interface UserSession {
  user: {
    id: string
    name: string
    email: string
    createdAt: string | Date
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
    words: 142,
    mastered: 85,
    streak: 21,
  }

  const recentWords = [
    {
      word: 'ephemeral',
      meaning: '一時的な、はかない',
      note: '3分前に復習',
    },
    {
      word: 'meticulous',
      meaning: '几帳面な、綿密な',
      note: '今日の新規登録',
    },
    {
      word: 'resilient',
      meaning: '回復力のある、しなやかな',
      note: '昨日の復習',
    },
    {
      word: 'lucid',
      meaning: '明快な、分かりやすい',
      note: '2日前に復習',
    },
  ]

  return (
    <div className="min-h-screen bg-white text-black/80">
      <main className="max-w-[430px] mx-auto px-4 pt-5 pb-30 space-y-5">
        <Header onLogout={handleLogout} />

        <section className="grid grid-cols-3 gap-3">
          <StatCard label="Words" value={stats.words} cardClass="bg-white/62" />
          <StatCard label="Mastered" value={stats.mastered} cardClass="bg-white/50" />
          <StatCard label="Streak" value={stats.streak} cardClass="bg-white/38" />
        </section>

        <Activity />

        <section className="space-y-3">
          <div className="text-[2rem] leading-none text-black/60 px-1">Recent Words</div>
          {recentWords.map((item) => (
            <RecentWordItem
              key={`${item.word}-${item.note}`}
              word={item.word}
              meaning={item.meaning}
              note={item.note}
            />
          ))}
        </section>
      </main>

      <Footer />
    </div>
  )
}
