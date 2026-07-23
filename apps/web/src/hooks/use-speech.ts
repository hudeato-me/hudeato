import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API (speechSynthesis) を使ったテキスト読み上げの薄いラッパー。
// クイズの出題プロンプト読み上げなど、外部APIを使わず端末内で完結させたい箇所向け。
export function useSpeech() {
	const isSupported =
		typeof window !== "undefined" && "speechSynthesis" in window;
	const [isSpeaking, setIsSpeaking] = useState(false);
	// cancel()による前発話の巻き戻し中に、古いutteranceのonend/onerrorが遅れて発火して
	// 新しい発話のisSpeakingを誤って倒すのを防ぐため、「今アクティブなutterance」を保持する
	const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

	const speak = useCallback(
		(text: string, lang: string) => {
			if (!isSupported || !text.trim()) return;
			// 再タップ時は前の発話をcancelしてから話す
			window.speechSynthesis.cancel();

			const utterance = new SpeechSynthesisUtterance(text);
			utterance.lang = lang;
			activeUtteranceRef.current = utterance;

			utterance.onstart = () => {
				if (activeUtteranceRef.current === utterance) setIsSpeaking(true);
			};
			const handleFinish = () => {
				if (activeUtteranceRef.current === utterance) setIsSpeaking(false);
			};
			utterance.onend = handleFinish;
			utterance.onerror = handleFinish;

			window.speechSynthesis.speak(utterance);
		},
		[isSupported],
	);

	const cancel = useCallback(() => {
		if (!isSupported) return;
		activeUtteranceRef.current = null;
		window.speechSynthesis.cancel();
		setIsSpeaking(false);
	}, [isSupported]);

	// unmount時（次の問題への遷移など）は必ず読み上げを止める
	useEffect(() => {
		return () => {
			if (isSupported) window.speechSynthesis.cancel();
		};
	}, [isSupported]);

	return { speak, cancel, isSpeaking, isSupported };
}
