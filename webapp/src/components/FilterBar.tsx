interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  filters: {
    key: string;
    label: string;
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
  }[];
}

export default function FilterBar({ filters }: FilterBarProps) {
  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      {filters.map((filter) => (
        <div key={filter.key} className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => filter.onChange('')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              filter.value === ''
                ? 'bg-accent text-white border-accent'
                : 'bg-bg-secondary text-text-secondary border-border hover:border-muted'
            }`}
          >
            All {filter.label}
          </button>
          {filter.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => filter.onChange(filter.value === opt.value ? '' : opt.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                filter.value === opt.value
                  ? 'bg-accent text-white border-accent'
                  : 'bg-bg-secondary text-text-secondary border-border hover:border-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
