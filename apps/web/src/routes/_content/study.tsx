import { createFileRoute, Link } from '@tanstack/react-router'
import { BsCardChecklist, BsBook } from 'react-icons/bs'
import { useContentContext } from '~/lib/content-context'
import { haptic } from '~/lib/haptic'

export const Route = createFileRoute('/_content/study')({
    ssr: false,
    component: StudyPage,
})

function StudyPage() {
    // コンテキストから選択中の単語セット名を表示する
    const { selectedWordSetId, wordSets } = useContentContext()
    const selectedWordSetName = wordSets.find((s) => s.id === selectedWordSetId)?.name ?? ''

    return (
        <div className="space-y-6">
            <section className="space-y-1 px-1">
                <h1 className="text-[1.05rem] font-medium text-black/85">学習</h1>
                {selectedWordSetName && (
                    <p className="text-sm text-black/40">{selectedWordSetName} の言葉で学ぶ</p>
                )}
            </section>

            <section className="space-y-3">
                {/* 4択クイズ: タップで /quiz へ */}
                <Link
                    to="/quiz"
                    onClick={() => haptic('medium')}
                    className="w-full bg-white border border-black/5 rounded-[14px] p-5 flex items-center gap-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.02)] active:scale-[0.98] transition-transform"
                >
                    <div className="w-12 h-12 shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <BsCardChecklist className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[1rem] font-medium text-black/85">4択クイズ</div>
                        <p className="text-[13px] text-black/40 mt-0.5 leading-snug">選んで覚える、テンポの良い復習</p>
                    </div>
                </Link>

                {/* 単語帳: タップで /cards へ */}
                <Link
                    to="/cards"
                    onClick={() => haptic('medium')}
                    className="w-full bg-white border border-black/5 rounded-[14px] p-5 flex items-center gap-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.02)] active:scale-[0.98] transition-transform"
                >
                    <div className="w-12 h-12 shrink-0 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                        <BsBook className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[1rem] font-medium text-black/85">単語帳</div>
                        <p className="text-[13px] text-black/40 mt-0.5 leading-snug">スワイプでテンポよく振り返る</p>
                    </div>
                </Link>
            </section>
        </div>
    )
}
