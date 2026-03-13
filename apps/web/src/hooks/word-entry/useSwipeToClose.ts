import { useState, useRef } from 'react';

interface UseSwipeToCloseProps {
    handleClose: () => void;
}

export function useSwipeToClose({ handleClose }: UseSwipeToCloseProps) {
    // スワイプでドロワーを閉じる機構
    // どれくらい下にスワイプされているか
    const [dragY, setDragY] = useState(0);
    // 最初のタッチした座標
    const startY = useRef<number | null>(null);
    // コンテンツエリアでのスワイプダウン用
    const contentStartY = useRef<number | null>(null);
    // スワイプダウンで閉じる動作中かどうか
    const [isSwipingDown, setIsSwipingDown] = useState(false);

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

    // コンテンツエリアで一番上にいる時に下スワイプで閉じるためのタッチハンドラー
    const handleContentSwipeStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const { scrollTop } = e.currentTarget;
        // 一番上までスクロールされている時だけ、スワイプダウンで閉じる動作を有効にする
        if (scrollTop <= 0) {
            contentStartY.current = e.touches[0].clientY;
        }
    };

    const handleContentSwipeMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (contentStartY.current === null) return;
        const { scrollTop } = e.currentTarget;
        const currentY = e.touches[0].clientY;
        const diff = currentY - contentStartY.current; // positive = swiping down

        // 一番上にいる状態で下方向にスワイプしている場合のみ
        if (diff > 0 && scrollTop <= 0) {
            // スワイプダウンで閉じるモードに入る
            setIsSwipingDown(true);
            // 抵抗をつけてドラッグ量を設定（指の動きの半分だけ追従する）
            setDragY(diff * 0.5);
            // ブラウザのデフォルトスクロールを防ぐ（バウンス防止）
            e.preventDefault();
        } else if (isSwipingDown && diff <= 0) {
            // 上に戻った場合はリセット
            setIsSwipingDown(false);
            setDragY(0);
            contentStartY.current = null;
        }
    };

    const handleContentSwipeEnd = () => {
        if (contentStartY.current === null && !isSwipingDown) return;
        contentStartY.current = null;

        if (isSwipingDown) {
            setIsSwipingDown(false);
            if (dragY > 50) {
                // 閾値を超えたら閉じる（dragYを維持してスナップバックを防ぐ）
                handleClose();
            } else {
                // 元に戻る
                setDragY(0);
            }
        }
    };

    return {
        dragY,
        setDragY,
        isSwipingDown,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handleContentSwipeStart,
        handleContentSwipeMove,
        handleContentSwipeEnd
    };
}
