export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  )
}

// アコーディオンの矢印
export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  )
}

export function IllustrationPlaceholder() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="h-full w-full fill-none stroke-slate-800 stroke-[1.2]"
    >
      <path d="M40 160 Q 100 190 160 160" />
      <path d="M40 160 L 40 60 Q 100 90 160 60 L 160 160" />
      <line x1="100" y1="75" x2="100" y2="175" />
      <circle cx="60" cy="40" r="4" fill="currentColor" className="opacity-20" />
      <circle cx="140" cy="30" r="6" fill="currentColor" className="opacity-30" />
      <path d="M160 60 L 180 40" strokeDasharray="4 4" />
    </svg>
  )
}
