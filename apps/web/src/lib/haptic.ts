const isTouchDevice =
    typeof window !== "undefined"
        ? window.matchMedia("(pointer: coarse)").matches
        : false;

export type HapticVariation = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const HAPTIC_PATTERNS: Record<HapticVariation, number | number[]> = {
    light: 10,
    medium: 40,
    heavy: 100,
    success: [10, 30, 10, 30, 10],
    warning: [30, 30, 30],
    error: [50, 50, 50, 50, 50]
};

/**
 * Trigger haptic feedback on mobile devices.
 * Uses Vibration API on Android/modern browsers, and iOS checkbox trick on iOS.
 *
 * @param pattern - Vibration duration (ms) or pattern.
 * Custom patterns only work on Android devices. iOS uses fixed feedback.
 * See [Vibration API](https://developer.mozilla.org/docs/Web/API/Vibration_API)
 *
 * @example
 * import { haptic } from "@/lib/haptic"
 *
 * <Button onClick={() => haptic('light')}>Haptic</Button>
 */
export function haptic(pattern: HapticVariation | number | number[] = 'medium') {
    try {
        if (!isTouchDevice) return

        if ("vibrate" in navigator) {
            const vPattern = typeof pattern === 'string' ? HAPTIC_PATTERNS[pattern] : pattern;
            navigator.vibrate(vPattern)
            return
        }

        const label = document.createElement("label")
        label.ariaHidden = "true"
        label.style.cssText = "position: absolute; opacity: 0; pointer-events: none; width: 1px; height: 1px;"

        const input = document.createElement("input")
        input.type = "checkbox"
        input.setAttribute("switch", "")
        label.appendChild(input)

        try {
            document.head.appendChild(label)
            label.click()
        } finally {
            document.head.removeChild(label)
        }
    } catch { }
}
