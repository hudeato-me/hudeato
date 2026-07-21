import { useQuizSessions } from '~/hooks/use-quiz'
import { haptic } from '~/lib/haptic'
import type { QuizSessionSummary } from '~/types'

interface QuizHistorySectionProps {
    wordSetId: string
    onSelect: (sessionId: string) => void
}

const SCOPE_LABEL: Record<QuizSessionSummary['scope'], string> = {
    all: 'すべて',
    unanswered: '未正解',
}

const DIRECTION_LABEL: Record<QuizSessionSummary['direction'], string> = {
    wordToMeaning: '単語 → 意味',
    meaningToWord: '意味 → 単語',
}

// 実施日時を気の利いた形式で表示する。当日なら時刻のみ、それ以外は「月/日 時刻」。
function formatSessionDate(epochMs: number): string {
    const date = new Date(epochMs)
    const now = new Date()
    const isSameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    const time = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
    return isSameDay ? time : `${date.getMonth() + 1}/${date.getDate()} ${time}`
}

// クイズ開始画面の履歴セクション。「これまでのクイズ」見出し + カードリスト。
// 0件・未読み込みのときはセクションごと非表示にする（空の見出しだけ出さない）。
export function QuizHistorySection({ wordSetId, onSelect }: QuizHistorySectionProps) {
    const { data: sessions, isLoading } = useQuizSessions(wordSetId)

    if (isLoading) {
        return (
            <section className="space-y-3">
                <div className="text-[1rem] leading-none text-black/60 px-1">これまでのクイズ</div>
                <div className="space-y-2 animate-pulse">
                    <div className="h-[74px] w-full bg-black/[0.03] rounded-3xl" />
                    <div className="h-[74px] w-full bg-black/[0.03] rounded-3xl" />
                </div>
            </section>
        )
    }

    if (!sessions || sessions.length === 0) return null

    return (
        <section className="space-y-3">
            <div className="text-[1rem] leading-none text-black/60 px-1">これまでのクイズ</div>
            <div className="space-y-2">
                {sessions.map((session) => (
                    <QuizSessionCard key={session.id} session={session} onClick={() => onSelect(session.id)} />
                ))}
            </div>
        </section>
    )
}

function QuizSessionCard({ session, onClick }: { session: QuizSessionSummary; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={() => {
                haptic('medium')
                onClick()
            }}
            className="w-full text-left rounded-3xl border border-black/5 bg-black/2 backdrop-blur-xl px-5 py-4 flex items-center justify-between gap-3 transition-colors hover:bg-black/5 active:bg-black/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
            <div className="min-w-0">
                <div className="text-[1.25rem] leading-tight font-medium text-black/85">
                    {session.correctCount}
                    <span className="text-black/30 text-[0.95rem]"> / {session.totalCount}</span>
                </div>
                <p className="text-black/40 text-[12px] mt-1 truncate">
                    {SCOPE_LABEL[session.scope]} ・ {DIRECTION_LABEL[session.direction]} ・ {session.timeLimitSeconds}秒
                </p>
            </div>
            <span className="shrink-0 text-black/45 text-[13px] tabular-nums">
                {formatSessionDate(session.createdAt)}
            </span>
        </button>
    )
}
