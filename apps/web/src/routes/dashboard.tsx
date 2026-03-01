import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
// components
import { Activity } from '~/components/dashboard/Activity'
import { Footer } from '~/components/Footer'
import { Header } from '~/components/Header'
import { RecentWordItem } from '~/components/dashboard/RecentWordItem'
import { StatCard } from '~/components/dashboard/StatCard'
import { WordSetDrawer } from '~/components/wordset/WordSetDrawer'
// authentication client
import { authClient } from '~/lib/auth-client'
// query client
import { useQueryClient } from '@tanstack/react-query'
// custom hooks
import { useDashboard, useWordSets } from '~/hooks/use-words'
import type { WordSet } from '~/types'

type Session = typeof authClient.$Infer.Session

export const Route = createFileRoute('/dashboard')({
  // キャッシュを生かすため、サーバーサイドレンダリングは行わない
  ssr: false,
  // コンポーネントが描画される前の処理
  beforeLoad: async () => {
    // エラーが起きた場合はnullを返すようにフォールバック
    const result = await authClient.getSession().catch(() => null)

    // 画面読み込み時にuserがいなかったりエラーが起きれば、ログインページに遷移→ダッシュボード画面をそもそも表示させない
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
  const queryClient = useQueryClient()
  // beforeLoadからsession情報を受け取る
  const { session } = Route.useRouteContext()
  // ドロワーの開閉状態
  const [isWordSetDrawerOpen, setIsWordSetDrawerOpen] = useState(false)

  // wordSet一覧の取得（beforeLoadを通っている時点でsessionは確実にあるため true固定）
  const { data: wordSets = [] } = useWordSets(true)

  // 選択中のwordSetIdのstateの管理
  const [selectedIdState, setSelectedIdState] = useState<string | null>(null)

  // 実際に使用するID→最初のロード時は、selectedIdStateがnullなので、wordSets[0]?.id（つまり一番上のセット）が選ばれる
  const selectedWordSetId = selectedIdState ?? wordSets[0]?.id ?? null

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
    streak: dashboardData?.streak ?? 0,
  }

  const recentWords = dashboardData?.recentWords ?? []

  const selectedWordSetName = wordSets.find((s: WordSet) => s.id === selectedWordSetId)?.name ?? ''

  return (
    <div className="min-h-screen bg-white text-black/80">
      <main className="max-w-[430px] mx-auto px-4 pt-5 pb-30 space-y-5">
        <Header
          currentWordSet={selectedWordSetName}
          onOpenWordSet={() => setIsWordSetDrawerOpen(true)}
          onLogout={async () => {
            await authClient.signOut();
            queryClient.clear();
            // IndexedDBキャッシュも明示的に消去
            const { del } = await import('idb-keyval');
            await del('REACT_QUERY_OFFLINE_CACHE'); // PersistQueryClientProviderのkeyと合わせる
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
        onSelect={setSelectedIdState}
      />
      {/* wordSetが選択されている時だけFooterを表示 */}
      {selectedWordSetId && <Footer wordSetId={selectedWordSetId} />}
    </div>
  )
}