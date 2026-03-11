import { useState, useEffect, useCallback, useRef } from 'react'
import { Reorder, useDragControls } from 'motion/react'
import { useUpdateWordSet } from '~/hooks/use-words'
import { haptic } from '~/lib/haptic'
import type { FieldSetting } from '~/types'

// デフォルトのフィールド設定
const DEFAULT_FIELDS: FieldSetting[] = [
    { key: 'meaning', label: 'Meaning', type: 'textarea', visible: true, order: 1 },
    { key: 'partOfSpeech', label: 'Part of Speech', type: 'text', visible: true, order: 2 },
    { key: 'phonetic', label: 'Pronunciation', type: 'text', visible: true, order: 3 },
    { key: 'example', label: 'Example sentence', type: 'textarea', visible: true, order: 4 },
    { key: 'collocation', label: 'Collocation', type: 'text', visible: true, order: 5 },
    { key: 'synonym', label: 'Synonyms', type: 'text', visible: true, order: 6 },
    { key: 'etymology', label: 'Etymology', type: 'text', visible: true, order: 7 },
    { key: 'source', label: 'Source / Where you learned it', type: 'textarea', visible: true, order: 8 },
]

// アイコンコンポーネント
function CloseIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
        </svg>
    )
}

function DragHandle() {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-black/25">
            <circle cx="7" cy="4.5" r="1.3" />
            <circle cx="13" cy="4.5" r="1.3" />
            <circle cx="7" cy="10" r="1.3" />
            <circle cx="13" cy="10" r="1.3" />
            <circle cx="7" cy="15.5" r="1.3" />
            <circle cx="13" cy="15.5" r="1.3" />
        </svg>
    )
}

function EyeIcon({ visible }: { visible: boolean }) {
    if (visible) {
        return (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="h-4 w-4">
                <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
                <circle cx="8" cy="8" r="2" />
            </svg>
        )
    }
    return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="h-4 w-4 text-black/30">
            <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
            <circle cx="8" cy="8" r="2" />
            <line x1="2" y1="14" x2="14" y2="2" strokeWidth="1.5" />
        </svg>
    )
}

function PlusIcon() {
    return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4 text-black/40">
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
        </svg>
    )
}

// 追加可能なフィールドの選択肢
const ALL_FIELD_OPTIONS: Array<{ key: string; label: string; type: 'text' | 'textarea' }> = [
    { key: 'meaning', label: 'Meaning', type: 'textarea' },
    { key: 'partOfSpeech', label: 'Part of Speech', type: 'text' },
    { key: 'phonetic', label: 'Pronunciation', type: 'text' },
    { key: 'example', label: 'Example sentence', type: 'textarea' },
    { key: 'collocation', label: 'Collocation', type: 'text' },
    { key: 'synonym', label: 'Synonyms', type: 'text' },
    { key: 'etymology', label: 'Etymology', type: 'text' },
    { key: 'source', label: 'Source / Where you learned it', type: 'textarea' },
]

// --- ドラッグ可能なフィールド行コンポーネント ---
function DraggableFieldRow({
    field,
    onToggleVisibility,
}: {
    field: FieldSetting
    onToggleVisibility: (key: string) => void
}) {
    const dragControls = useDragControls()

    return (
        <Reorder.Item
            value={field}
            dragListener={false}
            dragControls={dragControls}
            className="bg-white border border-black/5 rounded-[14px] flex items-center gap-3 px-3 py-3 min-h-[60px] select-none"
            style={{ position: 'relative' }}
            whileDrag={{
                scale: 1.03,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 50,
                cursor: 'grabbing',
            }}
            animate={{ scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)', zIndex: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
            {/* ドラッグハンドル */}
            <div
                className="shrink-0 cursor-grab active:cursor-grabbing touch-none p-1"
                onPointerDown={(e) => {
                    haptic('light')
                    dragControls.start(e)
                }}
            >
                <DragHandle />
            </div>

            {/* ラベル＋タイプ */}
            <div className="flex-1 min-w-0">
                <p className="text-sm text-black/90 leading-5">{field.label}</p>
                <p className="text-xs text-black/40 leading-4">{field.type}</p>
            </div>

            {/* 表示/非表示トグル */}
            <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 active:scale-95 transition-all shrink-0"
                onClick={() => onToggleVisibility(field.key)}
                aria-label={field.visible ? '非表示にする' : '表示する'}
            >
                <EyeIcon visible={field.visible} />
            </button>
        </Reorder.Item>
    )
}

// --- 固定フィールド行（Meaning用、ドラッグ不可） ---
function FixedFieldRow({
    field,
    onToggleVisibility,
}: {
    field: FieldSetting
    onToggleVisibility: (key: string) => void
}) {
    return (
        <div className="bg-white border border-black/5 rounded-[14px] flex items-center gap-3 px-3 py-3 min-h-[60px] select-none">
            {/* ドラッグハンドル（無効） */}
            <div className="shrink-0 p-1 opacity-30">
                <DragHandle />
            </div>

            {/* ラベル＋タイプ */}
            <div className="flex-1 min-w-0">
                <p className="text-sm text-black/90 leading-5">{field.label}</p>
                <p className="text-xs text-black/40 leading-4">{field.type}</p>
            </div>

            {/* 表示/非表示トグル */}
            <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 active:scale-95 transition-all shrink-0"
                onClick={() => onToggleVisibility(field.key)}
                aria-label={field.visible ? '非表示にする' : '表示する'}
            >
                <EyeIcon visible={field.visible} />
            </button>
        </div>
    )
}

// --- 閉じる確認ダイアログ ---
function CloseConfirmDialog({
    open,
    onGoBack,
    onClose,
}: {
    open: boolean
    onGoBack: () => void
    onClose: () => void
}) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white rounded-2xl shadow-xl mx-8 w-full max-w-[320px] p-6">
                <p className="text-sm text-black/80 text-center leading-6 mb-6">
                    変更内容は適用されません。<br />閉じてもよろしいですか？
                </p>
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        className="w-full h-11 rounded-[14px] bg-black text-white text-sm font-medium active:scale-[0.98] transition-transform"
                        onClick={onGoBack}
                    >
                        設定画面に戻る
                    </button>
                    <button
                        type="button"
                        className="w-full h-11 rounded-[14px] border border-black/15 text-black/60 text-sm font-medium active:scale-[0.98] transition-transform"
                        onClick={onClose}
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    )
}

// --- メインモーダルコンポーネント ---
interface WordSetSettingsModalProps {
    open: boolean
    wordSetId: string
    wordSetName: string
    currentSettings: string | null | undefined
    onClose: () => void
}

export function WordSetSettingsModal({
    open,
    wordSetId,
    wordSetName,
    currentSettings,
    onClose,
}: WordSetSettingsModalProps) {
    // meaningフィールド（常に先頭固定）
    const [meaningField, setMeaningField] = useState<FieldSetting>(DEFAULT_FIELDS[0])
    // meaning以外のフィールド（並べ替え可能）
    const [draggableFields, setDraggableFields] = useState<FieldSetting[]>([])
    const [name, setName] = useState('')
    const [showAddPicker, setShowAddPicker] = useState(false)
    const [showCloseConfirm, setShowCloseConfirm] = useState(false)
    const [isSaved, setIsSaved] = useState(false)
    const updateWordSet = useUpdateWordSet()

    // 初期値を保持して変更検知に使う
    const initialNameRef = useRef('')
    const initialFieldsJsonRef = useRef('')

    // 全フィールドを結合して取得するヘルパー
    const getAllFields = useCallback(() => {
        return [meaningField, ...draggableFields]
    }, [meaningField, draggableFields])

    // 設定の初期化
    useEffect(() => {
        if (open) {
            setName(wordSetName)
            initialNameRef.current = wordSetName

            let allFields: FieldSetting[]
            if (currentSettings) {
                try {
                    allFields = JSON.parse(currentSettings) as FieldSetting[]
                } catch {
                    allFields = [...DEFAULT_FIELDS]
                }
            } else {
                allFields = [...DEFAULT_FIELDS]
            }

            // meaningを分離
            const meaning = allFields.find(f => f.key === 'meaning') ?? DEFAULT_FIELDS[0]
            const rest = allFields.filter(f => f.key !== 'meaning')

            setMeaningField(meaning)
            setDraggableFields(rest)
            initialFieldsJsonRef.current = JSON.stringify([meaning, ...rest])
            setShowAddPicker(false)
            setShowCloseConfirm(false)
            setIsSaved(false)
        }
    }, [open, currentSettings, wordSetName])

    // 変更があるかチェック
    const hasChanges = useCallback(() => {
        if (isSaved) return false
        const currentJson = JSON.stringify([meaningField, ...draggableFields])
        return name !== initialNameRef.current || currentJson !== initialFieldsJsonRef.current
    }, [name, meaningField, draggableFields, isSaved])

    // フィールドの表示/非表示を切り替え
    const toggleVisibility = useCallback((key: string) => {
        haptic('light')
        if (key === 'meaning') {
            setMeaningField(prev => ({ ...prev, visible: !prev.visible }))
        } else {
            setDraggableFields(prev => prev.map(f => f.key === key ? { ...f, visible: !f.visible } : f))
        }
    }, [])

    // フィールドを追加
    const addField = useCallback((key: string) => {
        const option = ALL_FIELD_OPTIONS.find(o => o.key === key)
        if (!option) return
        haptic('light')
        setDraggableFields(prev => {
            const newFields = [...prev, { ...option, visible: true, order: prev.length + 2 }]
            return newFields.map((f, i) => ({ ...f, order: i + 2 }))
        })
        setShowAddPicker(false)
    }, [])

    // ドラッグで並べ替え
    const handleReorder = useCallback((newFields: FieldSetting[]) => {
        setDraggableFields(newFields.map((f, i) => ({ ...f, order: i + 2 })))
    }, [])

    // 保存して閉じる
    const handleDone = useCallback(() => {
        haptic('medium')
        const trimmedName = name.trim()
        if (!trimmedName) return

        const allFields = [{ ...meaningField, order: 1 }, ...draggableFields.map((f, i) => ({ ...f, order: i + 2 }))]

        const nameChanged = trimmedName !== initialNameRef.current
        const settingsChanged = JSON.stringify(allFields) !== initialFieldsJsonRef.current

        if (!nameChanged && !settingsChanged) {
            onClose()
            return
        }

        updateWordSet.mutate(
            {
                setId: wordSetId,
                data: {
                    name: trimmedName,
                    ...(settingsChanged ? { settings: allFields } : {})
                }
            },
            {
                onSuccess: () => {
                    setIsSaved(true)
                    initialNameRef.current = trimmedName
                    initialFieldsJsonRef.current = JSON.stringify(allFields)
                    onClose()
                },
                onError: (err) => {
                    console.error('設定の保存に失敗しました', err)
                    onClose()
                }
            }
        )
    }, [wordSetId, name, meaningField, draggableFields, updateWordSet, onClose])

    // ×ボタン押下
    const handleCloseAttempt = useCallback(() => {
        haptic('light')
        if (hasChanges()) {
            setShowCloseConfirm(true)
        } else {
            onClose()
        }
    }, [hasChanges, onClose])

    // 追加可能なフィールド（まだリストにないもの）
    const allCurrentKeys = new Set([meaningField.key, ...draggableFields.map(f => f.key)])
    const availableFields = ALL_FIELD_OPTIONS.filter(opt => !allCurrentKeys.has(opt.key))

    const isSaving = updateWordSet.isPending

    return (
        <>
            <div
                className={`fixed inset-0 z-[80] transition-opacity duration-200 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                inert={!open}
            >
                {/* 背景オーバーレイ */}
                <div className="absolute inset-0 bg-black/40" />

                {/* 全画面モーダルコンテンツ */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div
                        className={`bg-white w-full h-full max-w-[430px] flex flex-col transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}
                    >
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between px-6 h-16 border-b border-black/10 shrink-0">
                            <h2 className="text-lg text-black/90" style={{ fontWeight: 400 }}>
                                セットの設定
                            </h2>
                            <button
                                type="button"
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-black/50 hover:bg-black/5 active:scale-95 transition-all"
                                onClick={handleCloseAttempt}
                                aria-label="閉じる"
                            >
                                <CloseIcon />
                            </button>
                        </div>

                        {/* コンテンツ（スクロール可能） */}
                        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4">
                            {/* セット名入力 */}
                            <div className="mb-5">
                                <label className="block text-xs text-black/50 mb-1.5">セット名</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full h-11 px-3 rounded-[12px] border border-black/10 bg-black/[0.02] text-sm text-black/85 outline-none focus:ring-1 focus:ring-black/20 transition-all"
                                    placeholder="セット名を入力"
                                />
                            </div>

                            {/* フィールドラベル */}
                            <label className="block text-xs text-black/50 mb-2">フィールド設定</label>

                            {/* Meaning（固定・先頭） */}
                            <div className="mb-2">
                                <FixedFieldRow
                                    field={meaningField}
                                    onToggleVisibility={toggleVisibility}
                                />
                            </div>

                            {/* その他フィールド（ドラッグ並べ替え可能） */}
                            <Reorder.Group
                                axis="y"
                                values={draggableFields}
                                onReorder={handleReorder}
                                className="flex flex-col gap-2 list-none"
                            >
                                {draggableFields.map((field) => (
                                    <DraggableFieldRow
                                        key={field.key}
                                        field={field}
                                        onToggleVisibility={toggleVisibility}
                                    />
                                ))}
                            </Reorder.Group>

                            {/* 新しいフィールドを追加 */}
                            {availableFields.length > 0 && (
                                <>
                                    {showAddPicker ? (
                                        <div className="mt-4 border border-dashed border-black/20 rounded-[14px] p-3">
                                            <p className="text-xs text-black/50 mb-2">追加するフィールドを選択</p>
                                            <div className="flex flex-col gap-1">
                                                {availableFields.map(opt => (
                                                    <button
                                                        key={opt.key}
                                                        type="button"
                                                        className="w-full text-left px-3 py-2.5 text-sm text-black/70 rounded-lg hover:bg-black/5 active:scale-[0.98] transition-all"
                                                        onClick={() => addField(opt.key)}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                className="mt-2 w-full text-center text-xs text-black/40 py-1"
                                                onClick={() => {
                                                    haptic('light')
                                                    setShowAddPicker(false)
                                                }}
                                            >
                                                キャンセル
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            className="mt-4 w-full h-12 rounded-[14px] border border-dashed border-black/20 text-black/50 text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                                            onClick={() => {
                                                haptic('light')
                                                setShowAddPicker(true)
                                            }}
                                        >
                                            <PlusIcon />
                                            新しいフィールドを追加
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        {/* フッター（完了ボタン） */}
                        <div className="px-6 pt-4 pb-6 border-t border-black/10 shrink-0">
                            <button
                                type="button"
                                className="w-full h-11 rounded-[14px] bg-black text-white text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                                onClick={handleDone}
                                disabled={isSaving || !name.trim()}
                            >
                                {isSaving ? '保存中...' : '完了'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 閉じる確認ダイアログ */}
            <CloseConfirmDialog
                open={showCloseConfirm}
                onGoBack={() => {
                    haptic('light')
                    setShowCloseConfirm(false)
                }}
                onClose={() => {
                    haptic('light')
                    setShowCloseConfirm(false)
                    onClose()
                }}
            />
        </>
    )
}
