interface FilterOption<T extends string> {
    value: T
    label: string
}

interface FilterTabsProps<T extends string> {
    options: FilterOption<T>[]
    value: T
    onChange: (value: T) => void
}

export function FilterTabs<T extends string>({ options, value, onChange }: FilterTabsProps<T>) {
    return (
        <div className="flex items-center gap-2">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={`h-9 px-5 rounded-[10px] text-sm transition-colors ${value === option.value
                        ? 'bg-black text-white font-medium'
                        : 'bg-black/[0.05] text-black/60'
                        }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}
