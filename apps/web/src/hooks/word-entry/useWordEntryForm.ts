import { useState, useRef, useCallback } from 'react';

export function useWordEntryForm() {
    const [word, setWord] = useState('');
    const [locationLabel, setLocationLabel] = useState('');
    const [imageKey, setImageKey] = useState<string | null>(null);
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

    // スワイプをトリガーにすると処理が連続して走ってしまうため、スワイプ中かどうかの状態を管理する
    const [isAddingMeaning, setIsAddingMeaning] = useState(false);
    // スワイプで意味追加をするため、連続での追加を防ぐ必要がある。
    // 1秒後にスワイプのロック状態を解除するタイマーのRef
    const addMeaningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 新しい意味を追加する関数
    const addMeaning = () => {
        setMeanings((prev) => [
            ...prev,
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
        setMeanings((prev) => {
            if (prev.length <= 1) return prev;
            return prev.filter((_, idx) => idx !== indexToRemove);
        });
        setActiveTab((prevTab) => {
            if (prevTab >= indexToRemove && prevTab > 0) {
                return prevTab - 1;
            }
            return prevTab;
        });
    };

    const updateMeaning = (index: number, field: string, value: string) => {
        setMeanings((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    // 現在のフォーム状態から送信用データをまとめる
    // handleclose()で呼ぶためにuseEffectの外で定義→0.8秒待たなくても閉じることが出来る
    // preserveBlanks: AI補完用。空欄を「意味なし」で埋めず空のまま送る
    // （埋めてしまうとサーバの「空欄のみ補完」が発動しなくなるため）
    const buildPayload = useCallback((options?: { preserveBlanks?: boolean }) => {
        const preserveBlanks = options?.preserveBlanks ?? false;
        return {
            text: word,
            locationLabel: locationLabel || null,
            imageKey: imageKey,
            meanings: meanings.map((m, idx) => ({
                meaning: preserveBlanks ? m.meaning : (m.meaning || '意味なし'),
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
    }, [word, locationLabel, imageKey, meanings]);

    return {
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
    };
}
