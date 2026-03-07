import { useState, useRef } from 'react';

interface UsePullToDeleteProps {
    effectiveWordId: string | null;
    // API削除＋ドロワー閉じの処理（アニメーション以外の実処理）
    onDelete: () => void;
}

export function usePullToDelete({ effectiveWordId, onDelete }: UsePullToDeleteProps) {
    const [overScroll, setOverScroll] = useState(0);
    const [isDeletingAnim, setIsDeletingAnim] = useState(false);
    const [isPulling, setIsPulling] = useState(false);

    // ドロワーを上スワイプして削除
    // タッチしたところのy座標
    const contentTouchStartY = useRef<number | null>(null);
    // タッチした時点でどれだけスクロールされていたか
    const initialOverScroll = useRef<number>(0);
    // PCのマウスホイール検知用タイマー（PCでのスワイプは後々消すかもだが、一旦開発環境では実装）
    const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // アニメーション開始 + API削除を組み合わせた削除関数
    const executeDelete = () => {
        setIsDeletingAnim(true);
        onDelete();
    };

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

    return {
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
    };
}
