import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCreateWord, useUpdateWord, useWord, useDeleteWord } from '~/hooks/use-words';

interface WordEntryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    wordSetId?: string;
    existingWordId?: string | null;
}

export function WordEntryDrawer({ isOpen, onClose, wordSetId, existingWordId }: WordEntryDrawerProps) {
    // 新規作成時に発行されたIDを内部で保持する
    const [createdWordId, setCreatedWordId] = useState<string | null>(null);

    // 実際に使用するWordId（既存のものか、今さっき作ったものか）
    const effectiveWordId = existingWordId || createdWordId;

    // 既存単語の取得
    const { data: existingData, isSuccess: isExistingDataReady } = useWord(
        wordSetId ?? '',
        effectiveWordId ?? '',
        isOpen && !!wordSetId && !!effectiveWordId
    );

    const [word, setWord] = useState('');
    const [locationLabel, setLocationLabel] = useState('');
    // 複数のMeaningを配列で管理するState。初期状態は1つ。
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
    const { mutate: createWord, mutateAsync: createWordAsync } = useCreateWord(wordSetId ?? '');
    const { mutate: updateWord, mutateAsync: updateWordAsync } = useUpdateWord(wordSetId ?? '');
    const { mutateAsync: deleteWordAsync } = useDeleteWord(wordSetId ?? '');


    // ドロワー内のデータの変更を検知するためのRef
    const lastSavedData = useRef<string>('');

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

    // saveの状態を管理するState
    const [isSaving, setIsSaving] = useState(false);

    // debounceタイマーのRef（handleCloseでキャンセルするため外部に保持）
    // ユーザーの入力から0.8秒待ってから保存するためのタイマー
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 現在のフォーム状態から送信用データをまとめる
    // handleclose()で呼ぶためにuseEffectの外で定義→0.8秒待たなくても閉じることが出来る
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
        // ドロワー未開閉、単語セット未選択、または単語未入力の場合はスキップ
        if (!isOpen || !wordSetId || !word.trim()) return;

        // 送信用のJSONデータの作成
        const currentData = JSON.stringify(buildPayload());

        // 初回ロード直後など、変更がない場合はスキップ
        if (currentData === lastSavedData.current) return;

        console.log('[DEBUG] Auto-save triggered. Difference detected.');
        console.log(' - lastSavedData:', lastSavedData.current);
        console.log(' - currentData:', currentData);

        // useEffectが呼ばれたということは変更があったため、setIsSavingをtrueにして保存中を示す
        setIsSaving(true);

        // 0.8秒待ってから保存する
        debounceTimerRef.current = setTimeout(async () => {
            console.log('[DEBUG] Executing debounced save for effectiveWordId:', effectiveWordId);
            const payload = buildPayload();

            try {
                // 既存の単語の更新である場合
                if (effectiveWordId) {
                    // Update
                    console.log('[DEBUG] Calling updateWord API now');
                    // updateWordAsyncを呼び出して保存
                    await updateWordAsync({ wordId: effectiveWordId, data: payload });
                    console.log('[DEBUG] Auto-save (updateWord) SUCCESS');
                } else {
                    // Create
                    console.log('[DEBUG] Calling createWord API now for auto-save');
                    // createWordAsyncを呼び出して保存
                    const response = await createWordAsync(payload);
                    console.log('[DEBUG] Auto-save (createWord) SUCCESS. New ID:', response.data?.id);
                    // 新規作成された単語のIDを保持
                    if (response.data && response.data.id) {
                        // createdWordIdに保存
                        setCreatedWordId(response.data.id);
                    }
                }
            } catch (error) {
                console.error('[DEBUG] Auto-save ERROR:', error);
            } finally {
                // 保存が完了したことを示す
                setIsSaving(false);
            }
            // 保存が完了したら、lastSavedDataを更新
            lastSavedData.current = currentData;
        }, 800);

        return () => {
            if (debounceTimerRef.current) {
                // タイマーをキャンセル
                clearTimeout(debounceTimerRef.current);
                // タイマーをリセット
                debounceTimerRef.current = null;
            }
            // 次の処理に移る前にsetIsSavingをfalseに戻す
            setIsSaving(false);
        };
    }, [word, meanings, locationLabel, isOpen, buildPayload, effectiveWordId, wordSetId, updateWordAsync, createWordAsync]);

    // ドロワー内の縦スクロール位置を管理するRef
    const mainContentRef = useRef<HTMLDivElement>(null);
    // Meaningタブ内の横スクロール位置を管理するRef
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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

    // スワイプをトリガーにすると処理が連続して走ってしまうため、スワイプ中かどうかの状態を管理する
    const [isAddingMeaning, setIsAddingMeaning] = useState(false);
    // スワイプで意味追加をするため、連続での追加を防ぐ必要がある。
    // 1秒後にスワイプのロック状態を解除するタイマーのRef
    const addMeaningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 新しい意味を追加する関数
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

    // 閉じる際の保存（最終バックアップ）
    const handleClose = () => {
        // 進行中のdebounceタイマーをキャンセル（二重保存の防止）
        // autoSaveAsyncで閉じられた後にまた保存処理が走ることを防止
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }

        // 即座にドロワーを閉じる（保存はバックグラウンドで実行）
        onClose();

        // 保存対象がない場合は何もしない
        if (!wordSetId || !word.trim()) return;

        // handleClose内で保存データを呼ぶ
        const currentData = JSON.stringify(buildPayload());
        // データが保存されていないかどうかをチェック
        // jsonで比較しなければいけない
        const hasUnsavedChanges = currentData !== lastSavedData.current;

        // 保存されていない場合は保存を実行
        if (hasUnsavedChanges) {
            lastSavedData.current = currentData;
            const payload = buildPayload();
            if (effectiveWordId) {
                updateWordAsync({ wordId: effectiveWordId, data: payload }).catch(console.error);
            } else {
                createWordAsync(payload).catch(console.error);
            }
        }
    };

    const [overScroll, setOverScroll] = useState(0);
    const [isDeletingAnim, setIsDeletingAnim] = useState(false);
    const [isPulling, setIsPulling] = useState(false);

    const executeDelete = async () => {
        // 単語か単語セットのIDが無い場合はスキップ
        if (!effectiveWordId || !wordSetId) return;

        setIsDeletingAnim(true);

        // 即座に保存フラグを折り、非同期で削除を実行
        lastSavedData.current = '';
        setWord('');

        deleteWordAsync(effectiveWordId).catch(error => {
            console.error('Failed to delete word:', error);
            setIsDeletingAnim(false);
            setOverScroll(0);
        });

        // 上に飛んで消えるアニメーションを一瞬見せてから即座にドロワーを閉じる
        setTimeout(() => {
            onClose();
        }, 400);
    };

    // ドロワーを上スワイプして削除
    // タッチしたところのy座標
    const contentTouchStartY = useRef<number | null>(null);
    // タッチした時点でどれだけスクロールされていたか
    const initialOverScroll = useRef<number>(0);
    // PCのマウスホイール検知用タイマー（PCでのスワイプは後々消すかもだが、一旦開発環境では実装）
    const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleContentTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        // 単語IDが無い場合はスキップ
        if (!effectiveWordId) return;
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // もし一番下まで到達しているなら
        if (Math.ceil(scrollTop + clientHeight) >= scrollHeight - 5 || overScroll > 0) {
            // 最初のタッチ位置
            contentTouchStartY.current = e.touches[0].clientY;
            // スクロール量
            initialOverScroll.current = overScroll;
            setIsPulling(true);
        }
    };

    const handleContentTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!effectiveWordId || contentTouchStartY.current === null) return;
        // 今の座標
        const currentY = e.touches[0].clientY;
        // 初期位置とのdiff
        const diff = contentTouchStartY.current - currentY;
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // もし一番下付近までスクロールされたら
        if (Math.ceil(scrollTop + clientHeight) >= scrollHeight - 5 || overScroll > 0) {
            // Deleteするためのスクロールに抵抗をつける。
            let newOverScroll = initialOverScroll.current + diff * 0.5; // Resistance
            if (newOverScroll < 0) newOverScroll = 0;

            setOverScroll(newOverScroll);

            // 一定値以上スクロールされるとそのまま削除
            if (newOverScroll > 350 && !isDeletingAnim) {
                setIsPulling(false);
                contentTouchStartY.current = null;
                executeDelete();
            }
        }
    };

    // 上スワイプして話したときのスクロール制御
    const handleContentTouchEnd = () => {
        if (!effectiveWordId || contentTouchStartY.current === null) return;
        setIsPulling(false);
        contentTouchStartY.current = null;

        // 300以上だと
        if (overScroll > 300) {
            executeDelete();
        } else if (overScroll > 50) {
            // 準安定状態にスナップ
            setOverScroll(150);
        } else {
            // 元に戻る
            setOverScroll(0);
        }
    };

    const handleContentWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (!effectiveWordId) return;
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (Math.ceil(scrollTop + clientHeight) >= scrollHeight - 5 || overScroll > 0) {
            setIsPulling(true);

            if (e.deltaY > 0) {
                setOverScroll(prev => {
                    const next = prev + e.deltaY * 0.3;
                    if (next > 350 && !isDeletingAnim) {
                        setTimeout(() => executeDelete(), 0);
                    }
                    return next;
                });
            } else if (e.deltaY < 0 && overScroll > 0) {
                setOverScroll(prev => Math.max(0, prev + e.deltaY * 0.3));
            }

            if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
            wheelTimeoutRef.current = setTimeout(() => {
                setIsPulling(false);
                setOverScroll(prev => {
                    if (prev > 300) {
                        executeDelete();
                        return prev;
                    } else if (prev > 50) {
                        return 150; // 準安定
                    } else {
                        return 0; // 戻る
                    }
                });
            }, 150);
        }
    };

    // ユーザーがドロワー内で上から下にスクロールした時に、overScrollを0にして削除ボタンを閉じる
    const handleMainContentScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (overScroll > 0) {
            const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
            if (Math.ceil(scrollTop + clientHeight) < scrollHeight - 5) {
                setOverScroll(0);
            }
        }
    };

    // スワイプでドロワーを閉じる機構
    // どれくらい下にスワイプされているか
    const [dragY, setDragY] = useState(0);
    // 最初のタッチした座標
    const startY = useRef<number | null>(null);

    // ドロワー上部のつまみをつかんだ時に発火する処理
    const handlePointerDown = (e: React.PointerEvent) => {
        // キャプチャすることで、要素外まで指がずれてもドラッグされる
        e.currentTarget.setPointerCapture(e.pointerId);
        startY.current = e.clientY;
    };
    // スワイプ量の計算
    const handlePointerMove = (e: React.PointerEvent) => {
        if (startY.current === null) return;

        const diff = e.clientY - startY.current;

        // 下方向のドラッグのみ許可
        if (diff > 0) {
            setDragY(diff);
        }
    };

    // ドロワー上部のつまみを話したときに発火する処理
    const handlePointerUp = (e: React.PointerEvent) => {
        if (startY.current === null) return;

        e.currentTarget.releasePointerCapture(e.pointerId);
        startY.current = null;

        if (dragY > 50) {
            // 閾値を超えたら閉じる（dragYを維持してスナップバックを防ぐ）
            handleClose();
        } else {
            setDragY(0);
        }
    };

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
                                    setIsPulling(false);
                                    executeDelete();
                                }
                            }}
                            onTouchStart={(e) => {
                                e.stopPropagation(); // Make sure this element handles the drag exclusively
                                contentTouchStartY.current = e.touches[0].clientY;
                                initialOverScroll.current = overScroll;
                                setIsPulling(true);
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
                                    setIsPulling(false);
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
                    onTouchStart={handleContentTouchStart}
                    onTouchMove={handleContentTouchMove}
                    onTouchEnd={handleContentTouchEnd}
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
