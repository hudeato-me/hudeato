import { BsPencil } from 'react-icons/bs'
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

// 結果一覧タップ時の解説ボトムシート。WordEntryDrawer と同じ様式
// （オーバーレイ + rounded-t-3xl + ドラッグハンドル）に合わせる。
export function QuizExplainSheet({ isOpen, onClose, wordSetId, wordId, onEdit }: QuizExplainSheetProps) {
    const { data: explain, isLoading, isError } = useQuizExplanation(wordSetId, wordId ?? '', isOpen && !!wordId)

    return (
        <div
            className={`fixed inset-0 z-[100] transition-opacity duration-300 ${
                isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
        >
            {/* 背景オーバーレイ */}
            <button
                type="button"
                className="absolute inset-0 bg-black/40 w-full cursor-default"
                onClick={onClose}
                aria-label="閉じる"
            />

            {/* シート本体 */}
            <div
                className={`absolute bottom-0 w-full bg-white rounded-t-3xl shadow-xl flex flex-col max-h-[85vh] transition-transform duration-300 ease-out ${
                    isOpen ? 'translate-y-0' : 'translate-y-full'
                }`}
            >
                {/* ドラッグハンドル */}
                <div className="w-full shrink-0 flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                </div>

                <div className="overflow-y-auto px-6 pb-8 pt-2 space-y-6">
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
                                    aria-label="単語を編集"
                                    className="shrink-0 -mr-2 -mt-1 w-11 h-11 rounded-full flex items-center justify-center text-black/35 active:bg-black/5 active:scale-90 transition-all"
                                >
                                    <BsPencil className="h-[18px] w-[18px]" />
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
            </div>
        </div>
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
