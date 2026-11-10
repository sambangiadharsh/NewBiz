import React from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  text?: string;
  className?: string;
}

/**
 * Reusable Warehouse Portal Spinner
 * Uiverse fade animation with 3 rhythmic glowing dots
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'rgb(0, 113, 128)',
  text = 'Loading...',
  className = '',
}) => {
  const sizeConfig = {
    sm: { dot: 'w-2 h-2', gap: 'gap-1', height: 'h-6' },
    md: { dot: 'w-3.5 h-3.5', gap: 'gap-1.5', height: 'h-10' },
    lg: { dot: 'w-5 h-5', gap: 'gap-2', height: 'h-16' },
  };

  const currentSize = sizeConfig[size] || sizeConfig.md;

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <div
        className={`uiverse-spinner ${currentSize.gap} ${currentSize.height}`}
        style={{ '--clr': color } as React.CSSProperties}
      >
        <span className={currentSize.dot} />
        <span className={currentSize.dot} />
        <span className={currentSize.dot} />
      </div>
      {text && (
        <p className="text-xs font-semibold text-slate-500 mt-2.5 text-center tracking-wide">
          {text}
        </p>
      )}
    </div>
  );
};

export default Spinner;

