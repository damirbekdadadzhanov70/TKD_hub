interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <p className="text-[15px] text-text-secondary">
        {title}
      </p>
      {description && (
        <p className="text-xs text-muted mt-1">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 text-sm font-medium text-accent bg-transparent border-none cursor-pointer active:opacity-70 transition-opacity"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
