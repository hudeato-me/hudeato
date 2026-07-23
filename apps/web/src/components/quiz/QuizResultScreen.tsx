import { useEffect, useRef, useState } from 'react'
import { BsCheck, BsX } from 'react-icons/bs'
import { WordEntryDrawer } from '~/components/WordEntryDrawer'
import { useInvalidateQuizAfterWordEdit } from '~/hooks/use-quiz'
import { haptic } from '~/lib/haptic'
import { QuizExplainSheet } from './QuizExplainSheet'
import { QuizSpinner } from './QuizSpinner'
import type { QuizSessionItem } from '~/types'

// フッターの出し分け。ライブ結果(その場でクイズを終えた直後)は
// やり直す/次へ の2アクション + クイズをやめる、履歴結果(過去セッションの再表示)は「戻る」のみを出す。
type QuizResultFooter =
    | {
          mode: 'live'
          isGeneratingNext: boolean
          onNext: () => void
          onRetrySame: () => void
          onQuit: () => void
      }
    | { mode: 'history'; onBack: () => void }

interface QuizResultScreenProps {
    wordSetId: string
    // 表示用レコード配列。ライブ結果・履歴結果のどちらも同じ形（QuizSessionItem）で渡す。
    items: QuizSessionItem[]
    footer: QuizResultFooter
}

// 結果一覧画面。スコアサマリ + 各問リスト。行タップで解説シートを開く。
// ライブ結果・過去履歴の再表示の両方から呼ばれる（表示用レコード配列を受けるだけの純表示コンポーネント）。
export function QuizResultScreen({ wordSetId, items, footer }: QuizResultScreenProps) {
    const [explainWordId, setExplainWordId] = useState<string | null>(null)
    // 解説シートの「編集」から開く単語編集ドロワー
    const [editingWordId, setEditingWordId] = useState<string | null>(null)
    const invalidateAfterWordEdit = useInvalidateQuizAfterWordEdit(wordSetId)
    // 解説シートを閉じるアニメーション(300ms)が終わってから編集ドロワーを開くためのタイマー
    const editOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (editOpenTimeoutRef.current) clearTimeout(editOpenTimeoutRef.current)
        }
    }, [])

    // 解説シートの編集ボタン: 二重シートを避けるため、解説シートを閉じてから編集ドロワーを開く
    const handleEditFromExplain = (wordId: string) => {
        setExplainWordId(null)
        editOpenTimeoutRef.current = setTimeout(() => {
            setEditingWordId(wordId)
        }, 300)
    }

    // 編集ドロワーを閉じたタイミングで解説・履歴詳細のキャッシュを無効化する
    // （解説シートには戻らず結果画面に戻る）
    const handleCloseEdit = () => {
        if (editingWordId) invalidateAfterWordEdit(editingWordId)
        setEditingWordId(null)
    }

    const total = items.length
    const correctCount = items.filter((item) => item.correct).length
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0
    const isPerfect = total > 0 && correctCount === total

    return (
        <div className="space-y-6">
            {/* スコアサマリ */}
            <section className="rounded-3xl border border-black/5 bg-black/[0.02] backdrop-blur-xl px-6 py-8 text-center space-y-2">
                {isPerfect && (
                    <div className="text-[13px] font-medium text-green-600">全問正解！お見事です 🎉</div>
                )}
                <div className="text-[2.75rem] leading-none font-medium text-black/85">
                    {correctCount}
                    <span className="text-black/30 text-[1.5rem]"> / {total}</span>
                </div>
                <p className="text-sm text-black/45">正答率 {accuracy}%</p>
            </section>

            {/* 各問リスト */}
            <section className="space-y-2">
                {items.map((item) => (
                    <button
                        key={`${item.wordId}-${item.meaningId}`}
                        type="button"
                        onClick={() => {
                            haptic('light')
                            setExplainWordId(item.wordId)
                        }}
                        className="w-full bg-white border border-black/5 rounded-[14px] p-4 flex items-start gap-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.02)] active:scale-[0.98] transition-transform"
                    >
                        <div
                            className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center mt-0.5 ${
                                item.correct ? 'bg-green-500/10 text-green-600' : 'bg-red-400/10 text-red-500'
                            }`}
                        >
                            {item.correct ? <BsCheck className="h-4 w-4" /> : <BsX className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[14px] text-black/80 leading-snug">{item.prompt}</p>
                            <p
                                className={`text-[13px] mt-1 ${
                                    item.selectedText === null ? 'italic text-black/35' : 'text-black/40'
                                }`}
                            >
                                あなたの回答: {item.selectedText ?? '時間切れ'}
                            </p>
                            {!item.correct && (
                                <p className="text-[13px] text-green-600 mt-0.5">正解: {item.correctText}</p>
                            )}
                        </div>
                    </button>
                ))}
            </section>

            {/* フッターアクション */}
            {footer.mode === 'live' ? (
                <section className="space-y-3 pt-2">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                haptic('light')
                                footer.onRetrySame()
                            }}
                            className="flex-1 h-12 rounded-full border border-black/10 text-black/70 text-[14px] font-medium active:scale-[0.98] transition-transform"
                        >
                            クイズをやり直す
                        </button>
                        <button
                            type="button"
                            disabled={footer.isGeneratingNext}
                            onClick={() => {
                                haptic('medium')
                                footer.onNext()
                            }}
                            className="flex-1 h-12 rounded-full bg-black text-white text-[14px] font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
                        >
                            {footer.isGeneratingNext ? <QuizSpinner /> : '次のクイズへ'}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            haptic('light')
                            footer.onQuit()
                        }}
                        className="w-full h-12 rounded-full text-black/45 text-[14px] font-medium active:scale-[0.98] transition-transform"
                    >
                        クイズをやめる
                    </button>
                </section>
            ) : (
                <section className="pt-2">
                    <button
                        type="button"
                        onClick={() => {
                            haptic('light')
                            footer.onBack()
                        }}
                        className="w-full h-12 rounded-full border border-black/10 text-black/70 text-[14px] font-medium active:scale-[0.98] transition-transform"
                    >
                        戻る
                    </button>
                </section>
            )}

            <QuizExplainSheet
                isOpen={explainWordId !== null}
                onClose={() => setExplainWordId(null)}
                wordSetId={wordSetId}
                wordId={explainWordId}
                onEdit={handleEditFromExplain}
            />

            <WordEntryDrawer
                isOpen={editingWordId !== null}
                onClose={handleCloseEdit}
                wordSetId={wordSetId}
                existingWordId={editingWordId}
            />
        </div>
    )
}
