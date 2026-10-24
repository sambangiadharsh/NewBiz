import React from 'react';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

export interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  iconColor?: string;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  icon: Icon,
  iconColor = 'text-[#7E2532] bg-[#7E2532]/10 border-[#7E2532]/20',
  loading = false,
  className,
  onClick,
}) => {
  if (loading) {
    return (
      <div
        className={cn(
          'bg-white p-4 rounded-xl border border-[#ECE5DC] shadow-xs flex flex-col justify-between min-h-[96px]',
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 shimmer rounded" />
          <div className="w-7 h-7 rounded-lg shimmer shrink-0" />
        </div>
        <div className="mt-2.5">
          <div className="h-6 w-24 shimmer rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'bg-white p-4 rounded-xl border border-[#ECE5DC] shadow-xs hover:border-[#DFD6CA] transition-all duration-150 flex flex-col justify-between min-h-[96px]',
        onClick && 'cursor-pointer hover:shadow-xs select-none',
        className
      )}
    >
      <div className="flex items-center justify-between text-stone-500">
        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 truncate">
          {label}
        </span>
        {Icon && (
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-stone-200/50 bg-[#FAF7F3]',
              iconColor
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight mt-1.5 truncate">
        {value}
      </div>
    </div>
  );
};
