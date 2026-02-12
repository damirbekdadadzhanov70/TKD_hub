interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export default function EmptyState({ icon = '📭', title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-1 text-text">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-text-secondary">
          {description}
        </p>
      )}
    </div>
  );
}
