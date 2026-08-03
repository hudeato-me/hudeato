import { BottomSheet } from '~/components/BottomSheet'
import { useQuizExplanation } from '~/hooks/use-quiz'
import { haptic } from '~/lib/haptic'
import type { QuizExplainMeaning } from '~/types'

interface QuizExplainSheetProps {
    isOpen: boolean
    onClose: () => void
    wordSetId: string
    wordId: string | null
    // 編集ボタンタップ時。呼び出し側で解説シートを閉じ、編集ドロワーを開く
    onEdit: (wordId: string) => void
}

// 結果一覧タップ時の解説ボトムシート。共通の BottomSheet
// （オーバーレイ + rounded-t-3xl + つまみ・下スワイプで閉じる）を使う。
export function QuizExplainSheet({ isOpen, onClose, wordSetId, wordId, onEdit }: QuizExplainSheetProps) {
    const { data: explain, isLoading, isError } = useQuizExplanation(wordSetId, wordId ?? '', isOpen && !!wordId)

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose}>
            <div className="px-6 pb-8 pt-2 space-y-6">
                    {isError ? (
                        <div className="py-10 text-center text-sm text-black/40">
                            解説を読み込めませんでした
                        </div>
                    ) : isLoading || !explain ? (
                        <ExplainSkeleton />
                    ) : (
                        <>
                            <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1 min-w-0">
                                    <h2 className="text-[1.4rem] font-medium text-black/85">{explain.text}</h2>
                                    {explain.locationLabel && (
                                        <p className="text-[13px] text-black/40">{explain.locationLabel}</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        haptic('light')
                                        if (wordId) onEdit(wordId)
                                    }}
                                    className="shrink-0 h-9 px-4 rounded-full border border-black/10 text-black/60 text-[13px] font-medium active:scale-[0.96] active:bg-black/5 transition-all"
                                >
                                    編集する
                                </button>
                            </div>

                            <div className="space-y-4">
                                {explain.meanings.map((meaning, idx) => (
                                    <MeaningBlock key={meaning.id} meaning={meaning} index={idx} />
                                ))}
                            </div>
                        </>
                    )}
            </div>
        </BottomSheet>
    )
}

// 意味1件分のブロック。null の欄は出さず、整った階層で表示する。
function MeaningBlock({ meaning, index }: { meaning: QuizExplainMeaning; index: number }) {
    const fields: { label: string; value: string }[] = [
        { label: '品詞', value: meaning.partOfSpeech ?? '' },
        { label: '発音', value: meaning.phonetic ?? '' },
        { label: '例文', value: meaning.example ?? '' },
        { label: 'コロケーション', value: meaning.collocation ?? '' },
        { label: '類語', value: meaning.synonym ?? '' },
        { label: '語源', value: meaning.etymology ?? '' },
        { label: '出典', value: meaning.source ?? '' },
    ].filter((field) => field.value.trim() !== '')

    return (
        <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-2">
                <span className="text-[11px] text-black/35 font-medium">意味 {index + 1}</span>
                {meaning.isRemembered && (
                    <div className="w-4 h-4 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    </div>
                )}
            </div>
            <p className="text-[15px] text-black/80 leading-snug">{meaning.meaning}</p>
            {fields.length > 0 && (
                <div className="space-y-2 pt-1">
                    {fields.map((field) => (
                        <div key={field.label} className="flex gap-3 text-[13px]">
                            <span className="text-black/35 shrink-0 w-[76px]">{field.label}</span>
                            <span className="text-black/60 leading-snug">{field.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// 解説取得中のスケルトン
function ExplainSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="h-7 w-32 bg-black/5 rounded-lg" />
            <div className="h-28 w-full bg-black/5 rounded-2xl" />
            <div className="h-28 w-full bg-black/5 rounded-2xl" />
        </div>
    )
}
