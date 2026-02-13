import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function Card({ children, onClick, className = '' }: CardProps) {
  return (
    <div
      className={`bg-bg-secondary rounded-xl border border-border p-5 mb-3 ${onClick ? 'cursor-pointer hover:border-accent/30 active:bg-bg-primary transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
