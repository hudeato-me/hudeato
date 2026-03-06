import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Activity } from '~/components/dashboard/Activity'
import { RecentWordItem } from '~/components/dashboard/RecentWordItem'
import { StatCard } from '~/components/dashboard/StatCard'
import { WordEntryDrawer } from '~/components/WordEntryDrawer'
import { useDashboard } from '~/hooks/use-words'
import { useContentContext } from '~/lib/content-context'

export const Route = createFileRoute('/_content/dashboard')({
    ssr: false,
    component: DashboardPage,
})

function DashboardPage() {
    // コンテキストから単語セットIDと単語セットのリストを取得
    const { selectedWordSetId, wordSets } = useContentContext()
    // 編集中の単語IDを管理するState
    const [editingWordId, setEditingWordId] = useState<string | null>(null)

    const {
        data: dashboardData,
        isLoading: isDashboardLoading,
        isError: isWordsError,
    } = useDashboard(selectedWordSetId ?? '', !!selectedWordSetId)

    const isWordsLoading = isDashboardLoading && wordSets.length > 0

    const stats = {
        // undifinedだったら0
        words: dashboardData?.totalWords ?? 0,
        mastered: dashboardData?.masteredWords ?? 0,
        streak: dashboardData?.streak ?? 0,
    }

    const recentWords = dashboardData?.recentWords ?? []

    return (
        <div className="space-y-5">
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
                            onClick={() => setEditingWordId(item.id)}
                        />
                    ))
                )}
            </section>

            <WordEntryDrawer
                isOpen={editingWordId !== null}
                onClose={() => setEditingWordId(null)}
                wordSetId={selectedWordSetId ?? undefined}
                existingWordId={editingWordId}
            />
        </div>
    )
}
