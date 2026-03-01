import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCreateWord, useUpdateWord, useWord } from '~/hooks/use-words';

interface WordEntryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    wordSetId?: string;
    existingWordId?: string | null;
}

export function WordEntryDrawer({ isOpen, onClose, wordSetId, existingWordId }: WordEntryDrawerProps) {
    // 既存単語の取得
    const { data: existingData, isSuccess: isExistingDataReady } = useWord(
        wordSetId ?? '',
        existingWordId ?? '',
        isOpen && !!wordSetId && !!existingWordId
    );

    const [word, setWord] = useState('');
    const [locationLabel, setLocationLabel] = useState('');
    // 複数のMeaningを配列で管理するステート。初期状態は1つ。
    const [meanings, setMeanings] = useState([
        {
            id: 1, // UI用ID
            meaning: '',
            partOfSpeech: '',
            phonetic: '',
            example: '',
            collocation: '',
            synonym: '',
            etymology: '',
            source: '',
        },
    ]);
    const [activeTab, setActiveTab] = useState(0);

    // カスタムフック
    const { mutate: createWord } = useCreateWord(wordSetId ?? '');
    const { mutate: updateWord } = useUpdateWord(wordSetId ?? '');

    // データ初期化（既存データがある場合）
    useEffect(() => {
        if (existingWordId && existingData?.data) {
            const data = existingData.data;
            setWord(data.text);
            setLocationLabel(data.locationLabel ?? '');

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
        } else if (!existingWordId && isOpen) {
            // 新規作成用にリセット
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
            setMeanings([initialMeaning]);
            setActiveTab(0);
        }
    }, [existingWordId, existingData, isOpen]);

    // ==== リアルタイム保存 (Auto Save) 機構 ====
    const [isSaving, setIsSaving] = useState(false);

    // 入力データの変更を追跡するRef
    const lastSavedData = useRef<string>('');

    // 現在のフォーム状態から送信用データを組み立てる
    const buildPayload = useCallback(() => {
        return {
            text: word,
            locationLabel: locationLabel || null,
            imageKey: null,
            meanings: meanings.map((m, idx) => ({
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
        };
    }, [word, locationLabel, meanings]);

    // 変更監視＆オートセーブ
    useEffect(() => {
        if (!isOpen || !wordSetId || !word.trim()) return;

        const currentData = JSON.stringify(buildPayload());

        // 初回ロード直後など、変更がない場合はスキップ
        if (currentData === lastSavedData.current) return;

        setIsSaving(true);

        const debouncedSave = setTimeout(() => {
            const payload = buildPayload();

            if (existingWordId) {
                // Update
                updateWord(
                    { wordId: existingWordId, data: payload },
                    {
                        onSettled: () => setIsSaving(false),
                    }
                );
            } else {
                // Create（仕様上、新規作成画面で文字を打ち始めたら枠ができて、以降はUUIDを持つが、
                // モップアップ用として簡易的に都度POSTしない工夫が必要。
                // ここではいったんPOSTし、IDを受け取って以降はUPDATEにするなどの方針が必要ですが、
                // 取り急ぎ Notionライクに「入力完了時に作成/更新」とするか、
                // debounceで保存します（簡易実装））

                // Note: 本当は新規作成時にIDを発行し、以降はPUTにするロジックが良い
            }

            lastSavedData.current = currentData;
        }, 800);

        return () => clearTimeout(debouncedSave);
    }, [word, meanings, locationLabel, isOpen, buildPayload, existingWordId, wordSetId, updateWord]);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 横スクロールイベントを監視してアクティブなタブを更新
    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollLeft, clientWidth } = scrollContainerRef.current;
        const index = Math.round(scrollLeft / clientWidth);
        setActiveTab(index);
    };

    const addMeaning = () => {
        setMeanings([
            ...meanings,
            {
                id: Date.now(),
                meaning: '',
                partOfSpeech: '',
                phonetic: '',
                example: '',
                collocation: '',
                synonym: '',
                etymology: '',
                source: '',
            },
        ]);
    };

    const removeMeaning = (indexToRemove: number) => {
        if (meanings.length <= 1) return;
        setMeanings(meanings.filter((_, idx) => idx !== indexToRemove));
        if (activeTab >= indexToRemove && activeTab > 0) {
            setActiveTab(activeTab - 1);
        }
    };

    const updateMeaning = (index: number, field: string, value: string) => {
        const updated = [...meanings];
        updated[index] = { ...updated[index], [field]: value };
        setMeanings(updated);
    };

    const scrollToTab = (index: number) => {
        if (!scrollContainerRef.current) return;
        const { clientWidth } = scrollContainerRef.current;
        scrollContainerRef.current.scrollTo({
            left: index * clientWidth,
            behavior: 'smooth',
        });
    };

    // ドロワー開閉時のbodyのスクロール制御
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // 閉じる際の保存（最終バックアップ）
    const handleClose = () => {
        if (wordSetId && word.trim() && !existingWordId) {
            const payload = buildPayload();
            createWord(payload, {
                onSettled: () => onClose()
            });
        } else {
            onClose();
        }
    };

    // ==== ドラッグ（スワイプ）で閉じる機構 (Pointer Events) ====
    const [dragY, setDragY] = useState(0);
    const startY = useRef<number | null>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
        // キャプチャすることで、ドラッグ中にマウスや指が要素外に出てもイベントを追跡できる
        e.currentTarget.setPointerCapture(e.pointerId);
        startY.current = e.clientY;
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (startY.current === null) return;

        const diff = e.clientY - startY.current;

        // 下方向のドラッグのみ許可
        if (diff > 0) {
            setDragY(diff);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (startY.current === null) return;

        e.currentTarget.releasePointerCapture(e.pointerId);

        if (dragY > 150) {
            // 閾値を超えたら閉じる
            handleClose();
        }

        // 状態リセット
        startY.current = null;
        setDragY(0);
    };

    // ドラッグ中のスタイル
    const drawerStyle = isOpen
        ? { transform: `translateY(${dragY}px)`, transition: dragY > 0 ? 'none' : 'transform 0.3s ease-out', height: '95vh' }
        : { transform: 'translateY(100%)', height: '95vh' };

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
                            <div className="font-semibold text-gray-800 select-none">{existingWordId ? 'Edit Word' : 'New Word'}</div>
                            {isSaving && <span className="text-xs text-gray-400 select-none">Saving...</span>}
                        </div>
                        {/* Saveボタン用の空要素 */}
                        <div className="w-10"></div>
                    </div>
                </div>

                {/* スクロールコンテンツ */}
                <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">

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
                            className="w-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2 pt-2 -mx-5 px-5"
                            onScroll={handleScroll}
                            style={{ scrollBehavior: 'smooth' }}
                        >
                            {meanings.map((item, idx) => (
                                <div key={item.id} className="w-full shrink-0 snap-start pr-5 lg:pr-0">
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
                                            <div className="space-y-1.5">
                                                <label className="text-gray-400 text-xs ml-1">Meaning</label>
                                                <textarea
                                                    placeholder="Enter meaning..."
                                                    value={item.meaning}
                                                    onChange={(e) => updateMeaning(idx, 'meaning', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-400 transition-all min-h-[80px]"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-gray-400 text-xs ml-1">Part of Speech</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g., noun"
                                                        value={item.partOfSpeech}
                                                        onChange={(e) => updateMeaning(idx, 'partOfSpeech', e.target.value)}
                                                        className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-400 transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-gray-400 text-xs ml-1">Pronunciation</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g., /word/"
                                                        value={item.phonetic}
                                                        onChange={(e) => updateMeaning(idx, 'phonetic', e.target.value)}
                                                        className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-400 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-gray-400 text-xs ml-1">Example sentence</label>
                                                <textarea
                                                    placeholder="Enter example sentence..."
                                                    value={item.example}
                                                    onChange={(e) => updateMeaning(idx, 'example', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-400 transition-all min-h-[80px]"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-gray-400 text-xs ml-1">Collocation</label>
                                                <input
                                                    type="text"
                                                    placeholder="Enter collocations..."
                                                    value={item.collocation}
                                                    onChange={(e) => updateMeaning(idx, 'collocation', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-400 transition-all"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-gray-400 text-xs ml-1">Synonyms</label>
                                                <input
                                                    type="text"
                                                    placeholder="Enter synonyms..."
                                                    value={item.synonym}
                                                    onChange={(e) => updateMeaning(idx, 'synonym', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-400 transition-all"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-gray-400 text-xs ml-1">Etymology</label>
                                                <input
                                                    type="text"
                                                    placeholder="Enter etymology..."
                                                    value={item.etymology}
                                                    onChange={(e) => updateMeaning(idx, 'etymology', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-400 transition-all"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-gray-400 text-xs ml-1">Source / Where you learned it</label>
                                                <input
                                                    type="text"
                                                    placeholder="Enter source..."
                                                    value={item.source}
                                                    onChange={(e) => updateMeaning(idx, 'source', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-400 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
                            <button type="button" className="w-full border border-gray-200 rounded-3xl h-32 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors gap-2">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                </svg>
                                <span className="text-sm">写真を追加</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 下部のプロンプト入力エリア */}
                <div className="absolute bottom-0 left-0 w-full p-4 bg-white border-t border-gray-100 flex items-center gap-2 px-5 pb-6">
                    <input
                        type="text"
                        placeholder="指示を入力"
                        className="flex-1 bg-white border border-gray-200 shadow-sm rounded-full px-5 py-3 outline-none text-sm focus:border-blue-400 transition-colors"
                    />
                    <button className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                            <path d="M12 3L14.5 9.5L21 12L14.5 14.5L12 21L9.5 14.5L3 12L9.5 9.5L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

            </div>
        </div>
    );
}
