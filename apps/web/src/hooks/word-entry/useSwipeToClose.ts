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

    return {
        dragY,
        setDragY,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp
    };
}
