import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function Card({ children, onClick, className = '' }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-border p-4 mb-3 ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
