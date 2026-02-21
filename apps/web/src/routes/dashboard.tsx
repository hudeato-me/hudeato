import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
// components
import { Activity } from '~/components/dashboard/Activity'
import { Footer } from '~/components/Footer'
import { Header } from '~/components/Header'
import { RecentWordItem } from '~/components/dashboard/RecentWordItem'
import { StatCard } from '~/components/dashboard/StatCard'
import { WordSetDrawer } from '~/components/wordset/WordSetDrawer'
// authentication client
import { authClient } from '~/lib/auth-client'
// custom hooks
import { useDashboard, useWordSets } from '~/hooks/useWords'

type Session = typeof authClient.$Infer.Session

export const Route = createFileRoute('/dashboard')({
  // コンポーネントが描画される前に実行されるガード処理
  beforeLoad: async () => {
    // エラーが起きた場合はnullを返すようにフォールバック
    const result = await authClient.getSession().catch(() => null)

    // userがいなかったりエラーが起きれば、ログインページに遷移
    if (!result?.data?.user) {
      throw redirect({ to: '/login' })
    }

    // user情報をcontextとしてComponent側に渡す
    return { session: result.data as Session }
  },
  // beforeLoadの待機中に表示されるローディングUI
  pendingComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-black/30 text-[0.95rem]">
      読み込み中...
    </div>
  ),
  component: DashboardPage,
})

function DashboardPage() {
  // useStateやuseEffectの代わりに、beforeLoadから安全にsessionを受け取る
  const { session } = Route.useRouteContext()
  
  const [isWordSetDrawerOpen, setIsWordSetDrawerOpen] = useState(false)
  const [selectedWordSetId, setSelectedWordSetId] = useState<string | null>(null)

  // wordSet一覧の取得（beforeLoadを通っている時点でsessionは確実にあるため true固定）
  const { data: wordSets = [] } = useWordSets(true)

  // 初回ロード時に最初のセットを選択
  useEffect(() => {
    if (wordSets.length > 0 && !selectedWordSetId) {
      setSelectedWordSetId(wordSets[0].id)
    }
  }, [wordSets, selectedWordSetId])
  // dashboardの情報をうけと

  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    isError: isWordsError,
  } = useDashboard(selectedWordSetId ?? '', !!selectedWordSetId)

  // wordSetが0件の場合はローディングを打ち切る
  const isWordsLoading = isDashboardLoading && wordSets.length > 0

  const stats = {
    words: dashboardData?.totalWords ?? 0,
    mastered: dashboardData?.masteredWords ?? 0,
    streak: 21,
  }

  const recentWords = dashboardData?.recentWords ?? []

  const selectedWordSetName = wordSets.find((s) => s.id === selectedWordSetId)?.name ?? ''

  return (
    <div className="min-h-screen bg-white text-black/80">
      <main className="max-w-[430px] mx-auto px-4 pt-5 pb-30 space-y-5">
        <Header
          currentWordSet={selectedWordSetName}
          onOpenWordSet={() => setIsWordSetDrawerOpen(true)}
          onLogout={async () => {
            await authClient.signOut()
          }}
        />

        <section className="grid grid-cols-3 gap-3">
          <StatCard label="Words" value={stats.words} cardClass="bg-black/2" />
          <StatCard label="Mastered" value={stats.mastered} cardClass="bg-black/4" />
          <StatCard label="Streak" value={stats.streak} cardClass="bg-black/6" />
        </section>

        <Activity timestamps={dashboardData?.activityTimestamps ?? []} />

        <section className="space-y-3">
          <div className="text-[1rem] leading-none text-black/60 px-1">Recent Words</div>
          {wordSets.length === 0 ? (
            <div className="text-sm text-black/45 px-1">単語セットを追加してください</div>
          ) : isWordsLoading ? (
            <div className="text-sm text-black/45 px-1">読み込み中...</div>
          ) : isWordsError ? (
            <div className="text-sm text-black/45 px-1">データ取得に失敗しました</div>
          ) : recentWords.length === 0 ? (
            <div className="text-sm text-black/45 px-1">まだ単語がありません</div>
          ) : (
            recentWords.map((item) => (
              <RecentWordItem
                key={item.id}
                word={item.text}
                meaning={item.meaning ?? '意味未登録'}
              />
            ))
          )}
        </section>
      </main>

      <WordSetDrawer
        open={isWordSetDrawerOpen}
        selectedSetId={selectedWordSetId ?? ''}
        sets={wordSets}
        onClose={() => setIsWordSetDrawerOpen(false)}
        onSelect={setSelectedWordSetId}
      />

      <Footer />
    </div>
  )
}