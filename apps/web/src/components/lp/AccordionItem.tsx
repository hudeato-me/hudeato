import { useState } from 'react'
import { ChevronDownIcon } from './icons'

export function AccordionItem({ question, answer }: { question: string; answer: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-white/40 bg-white/30 shadow-sm backdrop-blur-md transition-all hover:bg-white/40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors focus:outline-none"
      >
        <span className="flex items-start text-sm font-bold leading-relaxed text-slate-800">
          <span className="mr-3 text-slate-400">Q.</span>
          {question}
        </span>
        <ChevronDownIcon
          className={`ml-4 h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/20 px-6 pb-6 pt-2 text-sm leading-loose text-slate-600">
            <div className="flex">
              <span className="mr-3 font-bold text-slate-400">A.</span>
              <div>{answer}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
