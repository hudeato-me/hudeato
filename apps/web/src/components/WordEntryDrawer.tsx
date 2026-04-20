import React, { useRef, useEffect } from 'react';
import { useWord } from '~/hooks/use-words';
import { useWordEntryForm } from '~/hooks/word-entry/useWordEntryForm';
import { useWordAutoSave } from '~/hooks/word-entry/useWordAutoSave';
import { useSwipeToClose } from '~/hooks/word-entry/useSwipeToClose';
import { usePullToDelete } from '~/hooks/word-entry/usePullToDelete';

interface WordEntryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    wordSetId?: string;
    existingWordId?: string | null;
}

export function WordEntryDrawer({ isOpen, onClose, wordSetId, existingWordId }: WordEntryDrawerProps) {
    // ==== フォーム入力管理 ====
    const {
        word,
        setWord,
        locationLabel,
        setLocationLabel,
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

    // ==== オートセーブ・API通信管理 ====
    const {
        effectiveWordId,
        isSaving,
        setIsSaving,
        createdWordId,
        setCreatedWordId,
        lastSavedData,
        handleClose,
        deleteWord
    } = useWordAutoSave({
        wordSetId,
        existingWordId,
        isOpen,
        word,
        meanings,
        locationLabel,
        buildPayload,
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

    // ドロワー内の縦スクロール位置を管理するRef
    const mainContentRef = useRef<HTMLDivElement>(null);
    // Meaningタブ内の横スクロール位置を管理するRef
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // ドロワー開いたときの初期化
    useEffect(() => {
        // 既存単語のデータがある場合、それをセットする
        if (existingWordId && existingData?.data) {
            const data = existingData.data;
            setWord(data.text);
            setLocationLabel(data.locationLabel ?? '');
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
                imageKey: null,
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

    // 横スクロールイベントを監視してアクティブなタブを更新 & 引っ張って追加
    const handleScroll = () => {
        // scrollContainerRefが存在しない場合はスキップ
        if (!scrollContainerRef.current) return;
        // 横スクロール位置を取得
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        // 現在のタブを更新
        const index = Math.round(scrollLeft / clientWidth);
        // 現在のタブを更新
        setActiveTab(index);

        // 右へ強く引っ張られた時に引っ張りを検知して追加
        // スクロール可能な幅 (scrollWidth) を、表示領域 + スクロール量で 110px 以上超えたら追加
        // isOverscrollingRightがtrueの場合は、最後のタブであることが示される
        const isOverscrollingRight = scrollLeft + clientWidth > scrollWidth + 110;

        // 最後のタブが表示されており、さらに「力強く」スクロールしようとしたタイミングで追加判定
        if (isOverscrollingRight && meanings.length < 5 && !isAddingMeaning) {
            setIsAddingMeaning(true);

            // 実際に追加処理を呼ぶ
            addMeaning();

            // 確実に追加されたタブへスクロールさせるために少し待つ
            setTimeout(() => {
                const newIndex = meanings.length;
                setActiveTab(newIndex);
                scrollToTab(newIndex);
            }, 100);

            // 1秒間は連続して追加しないようロックする
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
