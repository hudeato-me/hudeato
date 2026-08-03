import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { client } from '~/lib/api-client'
import type { QuizDirection } from '~/types'

// Google Cloud TTS の言語パラメータ。将来、単語の言語自動判定に差し替える予定だが
// (issue #90)、API の lang パラメータ設計自体はそのまま流用できる形にしておく。
export type TtsLang = 'en' | 'ja'

// クイズの出題方向 → 読み上げ言語（wordToMeaning=プロンプトが英単語→en / meaningToWord=プロンプトが日本語の意味→ja）
export const ttsLangForDirection = (direction: QuizDirection): TtsLang =>
    direction === 'wordToMeaning' ? 'en' : 'ja'

// ===========================================================================
// 音声トグル（クイズ全体で1つの状態）
// localStorageに永続化し、出題画面・設定画面など複数コンポーネントから同じ状態を
// 参照・更新できるよう、モジュールスコープのストア + useSyncExternalStore で同期する。
// ===========================================================================

const VOICE_ENABLED_STORAGE_KEY = 'hudeato:quiz-voice'

const readStoredVoiceEnabled = (): boolean => {
    if (typeof window === 'undefined') return true
    try {
        const raw = window.localStorage.getItem(VOICE_ENABLED_STORAGE_KEY)
        // 未設定時は自動再生ONをデフォルトにする（まず機能の価値を体験してもらう）
        return raw === null ? true : raw === 'true'
    } catch {
        return true
    }
}

let voiceEnabled = readStoredVoiceEnabled()
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

const getSnapshot = () => voiceEnabled

const setVoiceEnabled = (next: boolean) => {
    voiceEnabled = next
    try {
        window.localStorage.setItem(VOICE_ENABLED_STORAGE_KEY, String(next))
    } catch {
        // localStorage不可（プライベートモード等）でも状態はメモリ内で維持し、UXは止めない
    }
    for (const listener of listeners) listener()
}

// クイズ全体で共有する音声トグルの状態。出題画面・設定画面のどちらから
// 変更しても同期する。OFFにした瞬間は呼び出し側（出題画面）で再生を即停止する。
export function useVoiceEnabled() {
    const enabled = useSyncExternalStore(subscribe, getSnapshot)
    const toggle = useCallback(() => setVoiceEnabled(!voiceEnabled), [])
    return { enabled, toggle }
}

// ===========================================================================
// 発音音声の再生
// ===========================================================================

// 同一 text+lang の音声Blob URLをメモリ内にキャッシュし、同じ単語の再フェッチを防ぐ。
export function useTtsPlayer() {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const blobUrlCacheRef = useRef<Map<string, string>>(new Map())

    const stop = useCallback(() => {
        const audio = audioRef.current
        if (!audio) return
        audio.pause()
        audio.currentTime = 0
    }, [])

    const play = useCallback(async (text: string, lang: TtsLang) => {
        const trimmed = text.trim()
        if (!trimmed) return

        try {
            const cacheKey = `${lang}:${trimmed}`
            let url = blobUrlCacheRef.current.get(cacheKey)
            if (!url) {
                const res = await client.api.v1.tts.$get({ query: { text: trimmed, lang } })
                if (!res.ok) throw new Error(`TTS API Error: ${res.status}`)
                const blob = await res.blob()
                url = URL.createObjectURL(blob)
                blobUrlCacheRef.current.set(cacheKey, url)
            }

            if (!audioRef.current) audioRef.current = new Audio()
            const audio = audioRef.current
            audio.src = url
            audio.currentTime = 0
            await audio.play()
        } catch (error) {
            // 再生失敗はUXを止めない（次の問題に進む・回答するなどの操作はそのまま続けられる）
            console.error('発音の再生に失敗しました:', error)
        }
    }, [])

    // unmount時（クイズ終了・「やめる」など）は再生を止め、Blob URLを全てrevokeする
    useEffect(() => {
        const blobUrlCache = blobUrlCacheRef.current
        return () => {
            audioRef.current?.pause()
            for (const url of blobUrlCache.values()) URL.revokeObjectURL(url)
            blobUrlCache.clear()
        }
    }, [])

    return { play, stop }
}
