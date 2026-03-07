import { useState, useRef, useEffect, useCallback } from 'react';
import { useCreateWord, useUpdateWord, useDeleteWord } from '~/hooks/use-words';

interface UseWordAutoSaveProps {
    wordSetId?: string;
    existingWordId?: string | null;
    isOpen: boolean;
    word: string;
    meanings: any[];
    locationLabel: string;
    buildPayload: () => any;
    onClose: () => void;
    setWord: (w: string) => void;
}

export function useWordAutoSave({
    wordSetId,
    existingWordId,
    isOpen,
    word,
    meanings,
    locationLabel,
    buildPayload,
    onClose,
    setWord,
}: UseWordAutoSaveProps) {
    // カスタムフック
    const { mutateAsync: createWordAsync } = useCreateWord(wordSetId ?? '');
    const { mutateAsync: updateWordAsync } = useUpdateWord(wordSetId ?? '');
    const { mutateAsync: deleteWordAsync } = useDeleteWord(wordSetId ?? '');

    // 新規作成時に発行されたIDを内部で保持する
    const [createdWordId, setCreatedWordId] = useState<string | null>(null);

    // 実際に使用するWordId（既存のものか、今さっき作ったものか）
    const effectiveWordId = existingWordId || createdWordId;

    // saveの状態を管理するState
    const [isSaving, setIsSaving] = useState(false);

    // ドロワー内のデータの変更を検知するためのRef
    const lastSavedData = useRef<string>('');

    // debounceタイマーのRef（handleCloseでキャンセルするため外部に保持）
    // ユーザーの入力から0.8秒待ってから保存するためのタイマー
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

    // 閉じる際の保存（最終バックアップ）
    const handleClose = useCallback(() => {
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
    }, [onClose, wordSetId, word, buildPayload, effectiveWordId, updateWordAsync, createWordAsync]);

    // 削除のAPI呼び出し部分のみを担当（アニメーション制御は呼び出し元で行う）
    const deleteWord = useCallback(async () => {
        // 単語か単語セットのIDが無い場合はスキップ
        if (!effectiveWordId || !wordSetId) return;

        // 即座に保存フラグを折り、非同期で削除を実行
        lastSavedData.current = '';
        setWord('');

        deleteWordAsync(effectiveWordId).catch(error => {
            console.error('Failed to delete word:', error);
        });

        // 上に飛んで消えるアニメーションを一瞬見せてから即座にドロワーを閉じる
        setTimeout(() => {
            onClose();
        }, 400);
    }, [effectiveWordId, wordSetId, setWord, deleteWordAsync, onClose]);

    return {
        effectiveWordId,
        isSaving,
        setIsSaving,
        createdWordId,
        setCreatedWordId,
        lastSavedData,
        handleClose,
        deleteWord
    };
}
