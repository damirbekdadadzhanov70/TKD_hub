interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export default function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="text-2xl mb-3 opacity-25">{icon}</div>}
      <h3 className="text-sm font-semibold mb-1 text-text-secondary">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-muted">
          {description}
        </p>
      )}
    </div>
  );
}
