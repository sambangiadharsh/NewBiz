import React, { useState, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce.js';

export interface SearchBarProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  debounceMs?: number;
  className?: string;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value: controlledValue,
  defaultValue = '',
  placeholder = 'Search...',
  onChange,
  isLoading = false,
  debounceMs = 350,
  className = '',
  autoFocus = false,
}) => {
  const [internalValue, setInternalValue] = useState<string>(
    controlledValue !== undefined ? controlledValue : defaultValue
  );
  const debouncedValue = useDebounce(internalValue, debounceMs);

  // Sync internal state if controlled value is updated externally (e.g., cleared by parent)
  useEffect(() => {
    if (controlledValue !== undefined && controlledValue !== internalValue) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  // Notify parent whenever debounced value changes
  useEffect(() => {
    onChange(debouncedValue.trim());
  }, [debouncedValue]);

  const handleClear = () => {
    setInternalValue('');
    onChange('');
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all"
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        {internalValue && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-lg hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 transition-colors"
            title="Clear search"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

