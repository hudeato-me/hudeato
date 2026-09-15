// ---------------------------------------------------------------------------
// クイズの正誤フィードバック音。
//
// 音源ファイルは持たず Web Audio API で合成する（追加ダウンロード0KB・初回から遅延なし）。
// 正解/不正解で同じ音色（マリンバ風）を使い、音程だけで正誤を伝える設計:
//   - 不正解がブザー音だと、反復学習で間違えるたびに罰を受けている感覚になる
//   - 音色が共通なら音量を絞っても、また小さなスピーカーでも正誤を判別できる
//
// 注意: iOS Safari では消音（マナー）スイッチが ON の間は Web Audio も鳴らない。
// 発音音声（HTMLAudioElement）と同じ挙動なので、ユーザーから見た一貫性は保たれる。
// ---------------------------------------------------------------------------

// 全体の音量。発音音声（TTS）より一段控えめにして、読み上げを邪魔しない。
const MASTER_GAIN = 0.5

// 正解: C6 → G6（完全5度の上昇）。不正解: G4 → E♭4（短3度の下降）。
// 上昇/下降と音域の差で、聞き分けの手がかりを二重に持たせる。
const CORRECT_NOTES = [
    { freq: 1047, at: 0, duration: 0.3 },
    { freq: 1568, at: 0.08, duration: 0.5 },
]
const WRONG_NOTES = [
    { freq: 392, at: 0, duration: 0.3 },
    { freq: 311, at: 0.08, duration: 0.45 },
]

type AudioContextConstructor = typeof AudioContext

const getAudioContextConstructor = (): AudioContextConstructor | null => {
    if (typeof window === 'undefined') return null
    return (
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: AudioContextConstructor })
            .webkitAudioContext ??
        null
    )
}

// AudioContext はタブごとに数個までしか作れないため、モジュール内で1つを使い回す。
let audioContext: AudioContext | null = null

const getAudioContext = (): AudioContext | null => {
    if (audioContext) return audioContext
    const Ctor = getAudioContextConstructor()
    if (!Ctor) return null
    try {
        audioContext = new Ctor()
    } catch {
        // 非対応環境・音声デバイス無しでも学習そのものは続けられるようにする
        return null
    }
    return audioContext
}

// ユーザー操作のタイミングで AudioContext を起こしておく。
// iOS/Safari は操作起点でないと resume できないため、クイズ開始のタップで呼ぶ。
// これを怠ると「時間切れ（タップ無し）の不正解音」が鳴らない。
export const primeQuizSound = () => {
    void getAudioContext()?.resume()
}

// マリンバ風の1音。基音のサイン波に4倍音を短く重ねて、木琴のアタックを作る。
const playMallet = (
    context: AudioContext,
    { freq, at, duration }: { freq: number; at: number; duration: number },
    gain: number,
) => {
    const startAt = context.currentTime + at

    const playPartial = (
        partialFreq: number,
        partialGain: number,
        partialDuration: number,
    ) => {
        const oscillator = context.createOscillator()
        const amp = context.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(partialFreq, startAt)
        // 指数カーブで減衰させる（0 は指定できないため十分小さい値まで落とす）
        amp.gain.setValueAtTime(0.0001, startAt)
        amp.gain.exponentialRampToValueAtTime(partialGain, startAt + 0.002)
        amp.gain.exponentialRampToValueAtTime(0.0001, startAt + partialDuration)
        oscillator.connect(amp).connect(context.destination)
        oscillator.start(startAt)
        oscillator.stop(startAt + partialDuration + 0.02)
    }

    playPartial(freq, gain, duration)
    playPartial(freq * 4, gain * 0.25, duration * 0.35)
}

// 正誤フィードバック音を鳴らす。呼び出し側で音声トグルのON/OFFを判定すること。
// 再生に失敗しても回答〜次問への流れは止めない。
export const playQuizAnswerSound = (correct: boolean) => {
    const context = getAudioContext()
    if (!context) return
    try {
        // 直前のタップで suspended から戻っていない場合に備える（await しない）
        void context.resume()
        const notes = correct ? CORRECT_NOTES : WRONG_NOTES
        const gain = (correct ? 0.3 : 0.28) * MASTER_GAIN
        for (const note of notes) playMallet(context, note, gain)
    } catch (error) {
        console.error('効果音の再生に失敗しました:', error)
    }
}
