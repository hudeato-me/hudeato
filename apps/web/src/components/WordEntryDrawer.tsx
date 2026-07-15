import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useWord, useWordSets, useCreateWord, useUpdateWord, useCompleteWord } from '~/hooks/use-words';
import { useWordEntryForm } from '~/hooks/word-entry/useWordEntryForm';
import { useWordAutoSave } from '~/hooks/word-entry/useWordAutoSave';
import { useSwipeToClose } from '~/hooks/word-entry/useSwipeToClose';
import { usePullToDelete } from '~/hooks/word-entry/usePullToDelete';
import { haptic } from '~/lib/haptic';
import { ImagePicker } from '~/components/ImagePicker';
import type { FieldSetting, WordSet } from '~/types';

interface WordEntryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    wordSetId?: string;
    existingWordId?: string | null;
}

// フィールド設定マップ: key -> { label, placeholder, fieldName, type }
const FIELD_CONFIG: Record<string, { label: string; placeholder: string; fieldName: string; type: 'text' | 'textarea' }> = {
    meaning: { label: 'Meaning', placeholder: 'Enter meaning...', fieldName: 'meaning', type: 'textarea' },
    partOfSpeech: { label: 'Part of Speech', placeholder: 'e.g., noun', fieldName: 'partOfSpeech', type: 'text' },
    phonetic: { label: 'Pronunciation', placeholder: 'e.g., /word/', fieldName: 'phonetic', type: 'text' },
    example: { label: 'Example sentence', placeholder: 'Enter example sentence...', fieldName: 'example', type: 'textarea' },
    collocation: { label: 'Collocation', placeholder: 'Enter collocations...', fieldName: 'collocation', type: 'text' },
    synonym: { label: 'Synonyms', placeholder: 'Enter synonyms...', fieldName: 'synonym', type: 'text' },
    etymology: { label: 'Etymology', placeholder: 'Enter etymology...', fieldName: 'etymology', type: 'text' },
    source: { label: 'Source / Where you learned it', placeholder: 'Enter source...', fieldName: 'source', type: 'textarea' },
};

// デフォルトのフィールド順序
const DEFAULT_FIELD_ORDER = ['meaning', 'partOfSpeech', 'phonetic', 'example', 'collocation', 'synonym', 'etymology', 'source'];

// 設定に基づいてフィールドを動的にレンダリングするコンポーネント
function MeaningFields({
    item,
    idx,
    updateMeaning,
    fieldOrder,
    isAiCompleting = false,
}: {
    item: Record<string, any>;
    idx: number;
    updateMeaning: (index: number, field: string, value: string) => void;
    fieldOrder: string[];
    // AI補完中は空欄フィールドをシマー表示にする（入力は妨げない）
    isAiCompleting?: boolean;
}) {
    const elements: React.ReactNode[] = [];
    let i = 0;
    while (i < fieldOrder.length) {
        const key = fieldOrder[i];
        const config = FIELD_CONFIG[key];
        if (!config) { i++; continue; }

        // AI補完の対象（=空欄）だけをシマー表示。source はAI補完対象外
        const isCompletionTarget =
            isAiCompleting &&
            config.fieldName !== 'source' &&
            !String(item[config.fieldName] ?? '').trim();
        const fieldClass = isCompletionTarget
            ? 'animate-pulse bg-blue-50/60 border-blue-200 placeholder:text-blue-400'
            : 'bg-white border-gray-200';
        const placeholder = isCompletionTarget ? 'AIが補完中...' : config.placeholder;

        if (config.type === 'textarea') {
            elements.push(
                <div key={key} className="space-y-1.5">
                    <label className="text-gray-400 text-xs ml-1">{config.label}</label>
                    <textarea
                        placeholder={placeholder}
                        value={item[config.fieldName] ?? ''}
                        onChange={(e) => updateMeaning(idx, config.fieldName, e.target.value)}
                        className={`w-full border rounded-2xl px-4 py-3 outline-none focus:border-blue-400 transition-all min-h-[80px] ${fieldClass}`}
                    />
                </div>
            );
        } else {
            elements.push(
                <div key={key} className="space-y-1.5">
                    <label className="text-gray-400 text-xs ml-1">{config.label}</label>
                    <input
                        type="text"
                        placeholder={placeholder}
                        value={item[config.fieldName] ?? ''}
                        onChange={(e) => updateMeaning(idx, config.fieldName, e.target.value)}
                        className={`w-full border rounded-2xl px-4 py-3 outline-none focus:border-blue-400 transition-all ${fieldClass}`}
                    />
                </div>
            );
        }
        i++;
    }
    return <>{elements}</>;
}

export function WordEntryDrawer({ isOpen, onClose, wordSetId, existingWordId }: WordEntryDrawerProps) {
    // ==== 単語セット設定からフィールド順序を取得 ====
    const { data: wordSets = [] } = useWordSets(true);
    const fieldOrder = useMemo(() => {
        if (!wordSetId) return DEFAULT_FIELD_ORDER;
        const currentSet = wordSets.find((s: WordSet) => s.id === wordSetId);
        if (!currentSet?.settings) return DEFAULT_FIELD_ORDER;
        try {
            const parsed = JSON.parse(currentSet.settings as string) as FieldSetting[];
            return parsed
                .filter(f => f.visible)
                .sort((a, b) => a.order - b.order)
                .map(f => f.key);
        } catch {
            return DEFAULT_FIELD_ORDER;
        }
    }, [wordSetId, wordSets]);

    // ==== フォーム入力管理 ====
    const {
        word,
        setWord,
        locationLabel,
        setLocationLabel,
        imageKey,
        setImageKey,
        meanings,
        setMeanings,
        activeTab,
        setActiveTab,
        isAddingMeaning,
        setIsAddingMeaning,
        addMeaningTimeoutRef,
        addMeaning,
        removeMeaning,
        updateMeaning,
        buildPayload
    } = useWordEntryForm();

    // ==== AI補完の状態（P1-7/P1-8） ====
    // 生成中もユーザーを画面に閉じ込めない。閉じれば一覧のバッジに引き継ぎ、
    // 開いたままなら空欄シマー→完了でその場に反映する。
    const [completionPrompt, setCompletionPrompt] = useState('');
    const [isRequestingAi, setIsRequestingAi] = useState(false);
    const [aiError, setAiError] = useState(false);
    // オートセーブに渡すペイロード生成を切り替えるためのRef（フック順序の都合でRef経由）
    const isAiActiveRef = useRef(false);
    // ドロワーの開閉セッション。閉じるたびに進め、閉じる前に発行した
    // 非同期リクエストの結果でstateを更新しないようにするためのRef
    const openSessionRef = useRef(0);

    // AI補完が進行中の間は、空欄を「意味なし」で潰さず保存する
    // （潰すとサーバの「空欄のみ補完」が対象を見失うため）
    const buildSavePayload = useCallback(() => {
        if (isAiActiveRef.current) {
            return { ...buildPayload({ preserveBlanks: true }), autoComplete: true };
        }
        return buildPayload();
    }, [buildPayload]);

    // ==== オートセーブ・API通信管理 ====
    const {
        effectiveWordId,
        isSaving,
        setIsSaving,
        createdWordId,
        setCreatedWordId,
        lastSavedData,
        handleClose,
        cancelPendingSave,
        waitForInFlightSave,
        deleteWord
    } = useWordAutoSave({
        wordSetId,
        existingWordId,
        isOpen,
        word,
        meanings,
        locationLabel,
        buildPayload: buildSavePayload,
        onClose,
        setWord,
    });

    // ==== 上スワイプで削除 ====
    const {
        overScroll,
        setOverScroll,
        isDeletingAnim,
        setIsDeletingAnim,
        isPulling,
        contentTouchStartY,
        initialOverScroll,
        executeDelete,
        handleContentTouchStart,
        handleContentTouchMove,
        handleContentTouchEnd,
        handleContentWheel,
        handleMainContentScroll
    } = usePullToDelete({
        effectiveWordId,
        onDelete: deleteWord
    });

    // ==== 下スワイプで閉じる ====
    const {
        dragY,
        setDragY,
        isSwipingDown,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handleContentSwipeStart,
        handleContentSwipeMove,
        handleContentSwipeEnd
    } = useSwipeToClose({ handleClose });

    // 既存単語の取得
    const { data: existingData, isSuccess: isExistingDataReady } = useWord(
        wordSetId ?? '',
        effectiveWordId ?? '',
        isOpen && !!wordSetId && !!effectiveWordId
    );

    // ==== AI補完のキック（P1-7/P1-8） ====
    const { mutateAsync: createWordWithAi } = useCreateWord(wordSetId ?? '');
    const { mutateAsync: updateWordForAi } = useUpdateWord(wordSetId ?? '');
    const { mutateAsync: requestCompletion } = useCompleteWord(wordSetId ?? '');

    // サーバ側の補完ステータス（ポーリングで更新される）
    const serverCompletionStatus = existingData?.data?.completionStatus;
    // リクエスト直後〜サーバがpendingを返すまでの隙間も含めて「補完中」を表す
    const isAiActive = isRequestingAi || serverCompletionStatus === 'pending';
    isAiActiveRef.current = isAiActive;

    const handleAiComplete = () => {
        if (!wordSetId || !word.trim() || isAiActive) return;
        haptic('success');
        setIsRequestingAi(true);
        setAiError(false);
        // キック時点のステータスを記録。サーバ側の変化（pending等）を観測するまで
        // isRequestingAiを下ろさない（先に下ろすと、pending初観測までの隙間に
        // 閉じ保存が「意味なし」で走り、AI補完の結果を上書き破壊するため）
        statusAtKickRef.current = serverCompletionStatus;
        // 進行中のデバウンス保存をキャンセル（キック側の保存と二重にならないように）
        cancelPendingSave();

        const prompt = completionPrompt.trim() || null;
        // 空欄を保持して送る（サーバの「空欄のみ補完」の対象にするため）
        const aiPayload = {
            ...buildPayload({ preserveBlanks: true }),
            autoComplete: true,
            completionPrompt: prompt,
        };
        // 以降のオートセーブ/閉時保存が重複しないよう、AI形状の文字列で保存済み扱いにする
        lastSavedData.current = JSON.stringify({
            ...buildPayload({ preserveBlanks: true }),
            autoComplete: true,
        });

        // 閉じない: ユーザーはこのまま結果を見てもいいし、いつ閉じてもいい。
        // 閉じた場合は一覧の「AI補完中」バッジ＋ポーリングが引き継ぐ。
        // ドロワーが閉じられたら以降の状態更新は捨てる（closeでリセット済みの
        // createdWordId 等を、遅れて解決したリクエストが復活させないため）。
        const session = openSessionRef.current;
        const isSessionAlive = () => openSessionRef.current === session;
        const kick = async () => {
            // タイマー発火済みの自動保存が走っていれば完了を待つ
            // （古い保存がキック側のPUTより後着して空欄を「意味なし」で潰すのを防ぐ）。
            const inFlightWordId = await waitForInFlightSave();
            const targetWordId = effectiveWordId ?? inFlightWordId;
            if (targetWordId) {
                // 作成済み → 現在の内容を空欄のまま保存して再補完をキック
                await updateWordForAi({ wordId: targetWordId, data: aiPayload });
                const res = await requestCompletion({ wordId: targetWordId, data: { prompt } });
                if (!isSessionAlive()) return;
                if (res.data?.completionStatus === 'failed') setAiError(true);
            } else {
                // 未作成 → 補完ONで新規作成（サーバ側でpending→キュー投入）
                const res = await createWordWithAi(aiPayload);
                if (!isSessionAlive()) return;
                if (res.data?.id) setCreatedWordId(res.data.id);
                if (res.data?.completionStatus === 'failed') setAiError(true);
                // 共有キャッシュヒットで即doneの場合、pending遷移が観測されないため
                // prevをpending扱いにして初回フェッチ(done)で反映エフェクトを発火させる
                if (res.data?.completionStatus === 'done') {
                    prevCompletionStatusRef.current = 'pending';
                }
            }
        };
        kick().catch((err) => {
            console.error('AI completion request failed:', err);
            if (!isSessionAlive()) return;
            setAiError(true);
            setIsRequestingAi(false);
        });
    };

    // サーバ側ステータスの変化（キック→pending/done/failed）を観測したら
    // リクエスト中フラグを下ろす。以降は serverCompletionStatus が「補完中」を担う。
    const statusAtKickRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (isRequestingAi && serverCompletionStatus !== statusAtKickRef.current) {
            setIsRequestingAi(false);
        }
    }, [isRequestingAi, serverCompletionStatus]);

    // ==== AI補完の完了をその場に反映（P1-8） ====
    // pending→done を検知したら、フォームの空欄にだけAI結果を流し込む（入力済みはユーザー優先）。
    const prevCompletionStatusRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        const prev = prevCompletionStatusRef.current;
        prevCompletionStatusRef.current = serverCompletionStatus;
        if (!isOpen || prev !== 'pending') return;

        if (serverCompletionStatus === 'done' && existingData?.data) {
            const serverMeanings = existingData.data.meanings ?? [];
            setMeanings((prevMeanings) => {
                const merged = prevMeanings.map((m, idx) => {
                    const sm = serverMeanings[idx];
                    if (!sm) return m;
                    return {
                        ...m,
                        meaning: m.meaning || sm.meaning || '',
                        partOfSpeech: m.partOfSpeech || sm.partOfSpeech || '',
                        phonetic: m.phonetic || sm.phonetic || '',
                        example: m.example || sm.example || '',
                        collocation: m.collocation || sm.collocation || '',
                        synonym: m.synonym || sm.synonym || '',
                        etymology: m.etymology || sm.etymology || '',
                    };
                });
                // AIが語義を追加した場合はフォームにも追加する
                for (let i = prevMeanings.length; i < serverMeanings.length; i++) {
                    const sm = serverMeanings[i];
                    merged.push({
                        id: Date.now() + i,
                        meaning: sm.meaning ?? '',
                        partOfSpeech: sm.partOfSpeech ?? '',
                        phonetic: sm.phonetic ?? '',
                        example: sm.example ?? '',
                        collocation: sm.collocation ?? '',
                        synonym: sm.synonym ?? '',
                        etymology: sm.etymology ?? '',
                        source: sm.source ?? '',
                    });
                }
                // 反映後の状態を保存済み扱いにして、オートセーブの往復を防ぐ
                // （init処理と同じく、buildPayloadの形を再現して比較文字列を先に揃える）
                lastSavedData.current = JSON.stringify({
                    text: word,
                    locationLabel: locationLabel || null,
                    imageKey: imageKey,
                    meanings: merged.map((m, idx) => ({
                        meaning: m.meaning || '意味なし',
                        partOfSpeech: m.partOfSpeech || null,
                        phonetic: m.phonetic || null,
                        example: m.example || null,
                        collocation: m.collocation || null,
                        synonym: m.synonym || null,
                        etymology: m.etymology || null,
                        source: m.source || null,
                        slot: idx + 1,
                    })),
                });
                return merged;
            });
            haptic('success');
        } else if (serverCompletionStatus === 'failed') {
            setAiError(true);
            haptic('medium');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverCompletionStatus, isOpen]);

    // ドロワー内の縦スクロール位置を管理するRef
    const mainContentRef = useRef<HTMLDivElement>(null);
    // Meaningタブ内の横スクロール位置を管理するRef
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    // フォーム初期化を開いている間に1回だけ行うためのRef
    // （補完ポーリングでexistingDataが更新されるたびに入力を上書きしないため）
    const hasInitializedRef = useRef(false);

    // ドロワー開いたときの初期化
    useEffect(() => {
        // 既存単語のデータがある場合、それをセットする（開いている間は1回だけ）
        if (existingWordId && existingData?.data && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
            const data = existingData.data;
            setWord(data.text);
            setLocationLabel(data.locationLabel ?? '');
            setImageKey(data.imageKey ?? null);
            // 意味の配列をセットする
            if (data.meanings && data.meanings.length > 0) {
                setMeanings(
                    data.meanings.map((m: any, idx: number) => ({
                        id: Date.now() + idx,
                        meaning: m.meaning ?? '',
                        partOfSpeech: m.partOfSpeech ?? '',
                        phonetic: m.phonetic ?? '',
                        example: m.example ?? '',
                        collocation: m.collocation ?? '',
                        synonym: m.synonym ?? '',
                        etymology: m.etymology ?? '',
                        source: m.source ?? '',
                    }))
                );
            }
            // 自動保存を機能させるためにドロワーを開いた初期状態をlastSavedDataとして保存
            const initPayload = {
                text: data.text,
                locationLabel: data.locationLabel ?? null,
                imageKey: data.imageKey ?? null,
                meanings: data.meanings && data.meanings.length > 0
                    ? data.meanings.map((m: any, idx: number) => ({
                        meaning: m.meaning || '意味なし',
                        partOfSpeech: m.partOfSpeech || null,
                        phonetic: m.phonetic || null,
                        example: m.example || null,
                        collocation: m.collocation || null,
                        synonym: m.synonym || null,
                        etymology: m.etymology || null,
                        source: m.source || null,
                        slot: idx + 1,
                    }))
                    : [{ meaning: '意味なし', partOfSpeech: null, phonetic: null, example: null, collocation: null, synonym: null, etymology: null, source: null, slot: 1 }]
            };
            // 既存データの初期文字列としてRefに保持→自動保存でdiffを見るための比較用
            lastSavedData.current = JSON.stringify(initPayload);
            // 新しい単語を作成する場合
        } else if (!effectiveWordId && isOpen && !createdWordId) {
            // 新規作成用にリセット（かつ、内部で作成された直後でない場合）
            let initialMeaning = {
                id: Date.now(),
                meaning: '',
                partOfSpeech: '',
                phonetic: '',
                example: '',
                collocation: '',
                synonym: '',
                etymology: '',
                source: '',
            };
            setWord('');
            setLocationLabel('');
            setImageKey(null);
            setMeanings([initialMeaning]);
            setActiveTab(0);
        }
    }, [effectiveWordId, existingData, isOpen, createdWordId]);

    // ドロワーが閉じたときのリセット処理
    useEffect(() => {
        // ドロワーが閉じられた場合
        if (!isOpen) {
            // lastSavedDataをリセット
            lastSavedData.current = '';
            // 保存状態をリセット
            setIsSaving(false);
            // ドロワーを下スワイプした量をリセット
            setOverScroll(0);
            // 削除アニメーションをリセット
            setIsDeletingAnim(false);
            // 新規作成された単語のIDをリセット
            setCreatedWordId(null);
            // ドロワーの位置を初期化
            setDragY(0);
            // ドロワー内のスクロール位置を初期化
            mainContentRef.current?.scrollTo(0, 0);
            scrollContainerRef.current?.scrollTo(0, 0);
            setActiveTab(0);
            // AI補完まわりの状態をリセット
            setCompletionPrompt('');
            setAiError(false);
            setIsRequestingAi(false);
            hasInitializedRef.current = false;
            prevCompletionStatusRef.current = undefined;
            // 閉じる前に発行した非同期リクエストの結果を無効化する
            openSessionRef.current += 1;
        }
    }, [isOpen]);

    const scrollToTab = (index: number) => {
        if (!scrollContainerRef.current) return;
        const { clientWidth } = scrollContainerRef.current;
        scrollContainerRef.current.scrollTo({
            left: index * clientWidth,
            behavior: 'smooth',
        });
    };

    // 横スクロールイベントを監視してアクティブなタブを更新
    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollLeft, clientWidth } = scrollContainerRef.current;
        const index = Math.round(scrollLeft / clientWidth);
        setActiveTab(index);
    };

    // 指を離した時 (touchend) のみ、追加アクションとハプティクス（振動）を発火する
    // iOSでのHaptic制限を回避するための処置
    const handleHorizontalTouchEnd = () => {
        if (!scrollContainerRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        const isOverscrollingRight = scrollLeft + clientWidth > scrollWidth + 50;

        if (isOverscrollingRight && meanings.length < 5 && !isAddingMeaning) {
            haptic('success');
            setIsAddingMeaning(true);
            addMeaning();

            setTimeout(() => {
                const newIndex = meanings.length;
                setActiveTab(newIndex);
                scrollToTab(newIndex);
            }, 100);

            if (addMeaningTimeoutRef.current) clearTimeout(addMeaningTimeoutRef.current);
            addMeaningTimeoutRef.current = setTimeout(() => {
                setIsAddingMeaning(false);
            }, 1000);
        }
    };

    // ドロワー開閉時のbodyのスクロール制御
    useEffect(() => {
        // ドロワーを開くとbodyはスクロールされない
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // ドロワーを閉じるとbodyはスクロールできる
        } else {
            document.body.style.overflow = '';
        }
        // ドロワーが閉じられたときにbodyのスクロール制御を解除する（ブラウザの戻るボタンなどでドロワーが解除された場合）
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // ドラッグ中のスタイル
    const currentTranslateY = isDeletingAnim ? '-100vh' : (dragY > 0 ? dragY : (overScroll > 0 ? -overScroll : 0));

    // アニメーション設定 (引き上げ時やドラッグなどの「操作中」以外はアニメーションを有効にする)
    const isAnimating = isDeletingAnim || (!isPulling && dragY === 0);
    const transitionStyle = isAnimating ? 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)' : 'none';

    // 削除アニメーション中は、すでにisOpenがfalseになっても上空へ飛ぶスタイルを維持する
    const drawerStyle = (isOpen || isDeletingAnim)
        ? { transform: `translateY(${currentTranslateY}${typeof currentTranslateY === 'number' ? 'px' : ''})`, transition: transitionStyle, height: '95vh' }
        : { transform: 'translateY(100%)', height: '95vh', transition: 'transform 0.3s ease-in-out' };

    // クリーンアップ
    useEffect(() => {
        return () => {
            if (addMeaningTimeoutRef.current) clearTimeout(addMeaningTimeoutRef.current);
        };
    }, []);

    return (
        <div
            className={`fixed inset-0 z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
        >
            {/* 背景オーバーレイ */}
            <button
                type="button"
                className="absolute inset-0 bg-black/40 w-full cursor-default"
                onClick={handleClose}
                aria-label="閉じる"
            />

            {/* ドロワー本体 */}
            <div
                className="absolute bottom-0 w-full bg-white rounded-t-3xl shadow-xl flex flex-col transition-transform"
                style={drawerStyle}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ドラッグ可能なヘッダーエリア */}
                <div
                    className="w-full shrink-0 cursor-grab active:cursor-grabbing touch-none"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    {/* ドラッグハンドル */}
                    <div className="w-full flex justify-center pt-3 pb-2">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                    </div>

                    {/* ヘッダー */}
                    <div className="flex items-center justify-between px-5 pb-4 border-b border-gray-100">
                        <button onClick={handleClose} className="p-2 -ml-2 text-gray-800 hover:bg-gray-100 rounded-full transition-colors cursor-pointer" aria-label="戻る">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="font-semibold text-gray-800 select-none">{effectiveWordId ? 'Edit Word' : 'New Word'}</div>
                            {isSaving && <span className="text-xs text-gray-400 select-none">Saving...</span>}
                        </div>
                        {/* スペース埋め */}
                        <div className="w-10 flex justify-end"></div>
                    </div>
                </div>

                {/* 背景に表示されるDeleteエリア（ドロワー自体の下に無限に広がる赤い尻尾） */}
                {effectiveWordId && (
                    <div
                        className="absolute left-0 w-full flex flex-col items-center overflow-hidden"
                        style={{
                            top: '100%',
                            height: '100vh',
                            backgroundColor: '#ef4444', // red-500
                        }}
                    >
                        <button
                            onClick={(e) => {
                                if (overScroll >= 50 && !isDeletingAnim) {
                                    e.stopPropagation();
                                    executeDelete();
                                }
                            }}
                            onTouchStart={(e) => {
                                e.stopPropagation(); // Make sure this element handles the drag exclusively
                                contentTouchStartY.current = e.touches[0].clientY;
                                initialOverScroll.current = overScroll;
                            }}
                            onTouchMove={(e) => {
                                e.stopPropagation();
                                if (contentTouchStartY.current === null) return;
                                const currentY = e.touches[0].clientY;
                                const diff = contentTouchStartY.current - currentY;

                                let newOverScroll = initialOverScroll.current + diff * 0.8; // Stronger resistance since dragging the button directly
                                if (newOverScroll < 0) newOverScroll = 0;
                                setOverScroll(newOverScroll);

                                if (newOverScroll > 350 && !isDeletingAnim) {
                                    contentTouchStartY.current = null;
                                    executeDelete();
                                }
                            }}
                            onTouchEnd={(e) => {
                                e.stopPropagation();
                                handleContentTouchEnd();
                            }}
                            style={{ height: `${Math.max(0, overScroll)}px` }}
                            className="flex flex-col items-center justify-center transition-all duration-300 w-full cursor-pointer focus:outline-none focus:bg-red-600 active:bg-red-600 z-10 touch-none"
                        >
                            <div className={`flex flex-col items-center transition-transform duration-300 ${overScroll > 300 ? 'scale-110' : 'scale-90'}`}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-6 h-6 mb-1 pointer-events-none">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span className="text-white font-bold tracking-wider text-xs pointer-events-none">
                                    {overScroll > 300 ? 'RELEASE TO DELETE' : (!isPulling && overScroll > 50 ? 'TAP TO DELETE' : 'PULL TO DELETE')}
                                </span>
                            </div>
                        </button>
                    </div>
                )}

                {/* スクロールコンテンツ */}
                <div
                    ref={mainContentRef}
                    className="flex-1 overflow-y-auto px-5 py-6 space-y-8 bg-white relative z-10"
                    onTouchStart={(e) => {
                        // 上スワイプ削除 + 下スワイプ閉じる の両方を処理
                        handleContentTouchStart(e);
                        handleContentSwipeStart(e);
                    }}
                    onTouchMove={(e) => {
                        // 下スワイプで閉じる動作中は、削除処理を無視する
                        if (isSwipingDown) {
                            handleContentSwipeMove(e);
                        } else {
                            handleContentTouchMove(e);
                            handleContentSwipeMove(e);
                        }
                    }}
                    onTouchEnd={(e) => {
                        handleContentTouchEnd();
                        handleContentSwipeEnd();
                    }}
                    onWheel={handleContentWheel}
                    onScroll={handleMainContentScroll}
                >

                    {/* 単語入力 */}
                    <div>
                        <input
                            type="text"
                            placeholder="Enter word..."
                            value={word}
                            onChange={(e) => setWord(e.target.value)}
                            className="w-full border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-lg"
                        />
                    </div>

                    {/* Meanings セクション */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h3 className="font-semibold text-gray-800">Meanings</h3>
                                <div className="flex items-center gap-1.5">
                                    {meanings.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`h-1.5 rounded-full transition-all ${idx === activeTab ? 'w-4 bg-gray-800' : 'w-1.5 bg-gray-300'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="text-xs text-gray-400 font-medium tracking-wide">
                                {activeTab + 1} / {meanings.length}
                            </div>
                        </div>

                        {/* タブ ナビゲーション */}
                        <div className="flex items-center gap-4 border-b border-gray-100 pb-2 overflow-x-auto no-scrollbar">
                            {meanings.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => scrollToTab(idx)}
                                    className={`text-sm tracking-wide whitespace-nowrap transition-colors relative pb-1 ${idx === activeTab ? 'text-gray-900 font-medium' : 'text-gray-400'
                                        }`}
                                >
                                    Meaning {idx + 1}
                                    {idx === activeTab && (
                                        <span className="absolute left-0 right-0 -bottom-2 h-0.5 bg-gray-800 rounded-full" />
                                    )}
                                </button>
                            ))}
                            {meanings.length < 5 && (
                                <button onClick={addMeaning} className="text-sm text-blue-500 whitespace-nowrap px-2 pb-1">
                                    + Add
                                </button>
                            )}
                        </div>

                        {/* 横スクロール Meaningコンテナ */}
                        <div
                            ref={scrollContainerRef}
                            className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2 pt-2 -mx-5 px-5"
                            onScroll={handleScroll}
                            onTouchEnd={handleHorizontalTouchEnd}
                            style={{ scrollBehavior: 'smooth' }}
                        >
                            {meanings.map((item, idx) => (
                                <div key={item.id} className="w-full shrink-0 snap-start pr-5">
                                    <div className="border border-gray-100 bg-gray-50/50 rounded-3xl p-5 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-500 font-medium">Meaning {idx + 1}</span>
                                            {meanings.length > 1 && (
                                                <button
                                                    onClick={() => removeMeaning(idx)}
                                                    className="text-gray-400 hover:text-red-500"
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-4 text-sm">
                                            <MeaningFields
                                                item={item}
                                                idx={idx}
                                                updateMeaning={updateMeaning}
                                                fieldOrder={fieldOrder}
                                                isAiCompleting={isAiActive}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {/* スクロール領域を必ず確保してスワイプ可能にするための見えないスペーサー */}
                            {meanings.length >= 1 && (
                                <div className="w-[10px] shrink-0 pointer-events-none" />
                            )}
                        </div>
                    </div>

                    <div className="space-y-6 pt-4 pb-[80px]">
                        {/* Location */}
                        <div className="space-y-2">
                            <label className="text-gray-400 text-xs ml-1">Location</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                                        <circle cx="12" cy="9" r="2.5" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Where did you learn this word?"
                                    value={locationLabel}
                                    onChange={(e) => setLocationLabel(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-4 outline-none focus:border-blue-400 transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Photo */}
                        <div className="space-y-2">
                            <label className="text-gray-400 text-xs ml-1">Photo</label>
                            <ImagePicker imageKey={imageKey} onChange={setImageKey} />
                        </div>
                    </div>
                </div>

                {/* 下部のAI補完エリア: プロンプト(任意)を添えて空欄をAIに補完させる。
                    補完中も閉じるのは自由（閉じたら一覧のバッジ＋ポーリングが引き継ぐ） */}
                <div className="absolute bottom-0 left-0 w-full bg-white border-t border-gray-100 px-5 pb-6 pt-3 z-20">
                    {/* 補完中/失敗のステータス表示 */}
                    {isAiActive && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-500 pb-2 pl-2 animate-pulse select-none">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                                <path d="M12 3L14.5 9.5L21 12L14.5 14.5L12 21L9.5 14.5L3 12L9.5 9.5L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            AIが空欄を補完中... このまま閉じてもOK
                        </div>
                    )}
                    {aiError && !isAiActive && (
                        <div className="text-xs text-red-500 pb-2 pl-2 select-none">
                            補完に失敗しました。もう一度お試しください
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="AIへの指示（例: 医学の文脈で）"
                            value={completionPrompt}
                            onChange={(e) => setCompletionPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                    handleAiComplete();
                                }
                            }}
                            className="flex-1 bg-white border border-gray-200 shadow-sm rounded-full px-5 py-3 outline-none text-sm focus:border-blue-400 transition-colors"
                        />
                        <button
                            onClick={handleAiComplete}
                            disabled={!word.trim() || isAiActive}
                            aria-label="AIで空欄を補完"
                            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${isAiActive
                                ? 'bg-blue-500 text-white animate-pulse'
                                : word.trim()
                                    ? 'bg-black text-white shadow-md'
                                    : 'bg-gray-100 text-gray-300'
                                }`}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                                <path d="M12 3L14.5 9.5L21 12L14.5 14.5L12 21L9.5 14.5L3 12L9.5 9.5L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
