import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Activity } from '~/components/dashboard/Activity'
import { Footer } from '~/components/Footer'
import { Header } from '~/components/Header'
import { RecentWordItem } from '~/components/dashboard/RecentWordItem'
import { StatCard } from '~/components/dashboard/StatCard'
import { WordSetDrawer } from '~/components/wordset/WordSetDrawer'
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
  const [isWordSetDrawerOpen, setIsWordSetDrawerOpen] = useState(false)
  const [selectedWordSet, setSelectedWordSet] = useState('英単語用')

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const result = await authClient.getSession()
        // userがいなかったらログインページに遷移
        if (!result.data?.user) {
          navigate({ to: '/login' })
          return
        }
        // user情報をsessionにセット
        setSession(result.data as UserSession)
      } catch {
        // エラーが起きれば、ログインページへ
        navigate({ to: '/login' })
      } finally {
        // ローディングを非表示に。
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
    },
    {
      word: 'meticulous',
      meaning: '几帳面な、綿密な',
    },
    {
      word: 'resilient',
      meaning: '回復力のある、しなやかな',
    },
    {
      word: 'lucid',
      meaning: '明快な、分かりやすい',
    },
  ]

  const wordSets = ['英単語用', '言葉集め用', '専門用語', 'ビジネス用語']

  return (
    <div className="min-h-screen bg-white text-black/80">
      <main className="max-w-[430px] mx-auto px-4 pt-5 pb-30 space-y-5">
        <Header
          onLogout={handleLogout}
          currentWordSet={selectedWordSet}
          onOpenWordSet={() => setIsWordSetDrawerOpen(true)}
        />

        <section className="grid grid-cols-3 gap-3">
          <StatCard label="Words" value={stats.words} cardClass="bg-black/2" />
          <StatCard label="Mastered" value={stats.mastered} cardClass="bg-black/4" />
          <StatCard label="Streak" value={stats.streak} cardClass="bg-black/6" />
        </section>

        <Activity />

        <section className="space-y-3">
          <div className="text-[1rem] leading-none text-black/60 px-1">Recent Words</div>
          {recentWords.map((item) => (
            <RecentWordItem key={`${item.word}-${item.meaning}`} word={item.word} meaning={item.meaning} />
          ))}
        </section>
      </main>

      <WordSetDrawer
        open={isWordSetDrawerOpen}
        selectedSet={selectedWordSet}
        sets={wordSets}
        onClose={() => setIsWordSetDrawerOpen(false)}
        onSelect={setSelectedWordSet}
      />

      <Footer />
    </div>
  )
}
