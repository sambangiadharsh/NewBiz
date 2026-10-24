import React, { useState, KeyboardEvent } from 'react';
import { Plus, X, Sparkles } from 'lucide-react';

interface FeatureTagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  placeholder?: string;
  disabled?: boolean;
  showLabel?: boolean;
  label?: string;
  helperText?: string;
}

export const FeatureTagInput: React.FC<FeatureTagInputProps> = ({
  tags,
  onChange,
  maxTags = 10,
  placeholder = 'Type feature & press Enter or comma (e.g. 100% Cotton, Ergonomic Grip)...',
  disabled = false,
  showLabel = true,
  label = 'Key Features & Highlights',
  helperText = 'Bullet points displayed on product detail page to attract customers.',
}) => {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (tags.length >= maxTags) return;
    if (!tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const handleRemove = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1 font-medium text-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            {label}
          </span>
          <span>
            {tags.length}/{maxTags} added
          </span>
        </div>
      )}

      <div className="p-2.5 bg-white border border-slate-200 rounded-xl focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all flex flex-wrap gap-2 items-center min-h-[46px]">
        {tags.map((tag, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-medium rounded-lg animate-in fade-in zoom-in-95 duration-150"
          >
            <span>{tag}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="hover:text-indigo-900 rounded-full p-0.5 hover:bg-indigo-200/50 transition-colors"
                title="Remove highlight"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        {!disabled && tags.length < maxTags && (
          <div className="flex-1 min-w-[200px] flex items-center gap-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleAdd}
              placeholder={tags.length === 0 ? placeholder : 'Add another feature...'}
              className="w-full text-xs text-slate-800 placeholder-slate-400 bg-transparent outline-none py-1"
            />
            {input.trim() && (
              <button
                type="button"
                onClick={handleAdd}
                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
      {helperText && (
        <p className="text-[11px] text-slate-400">
          {helperText}
        </p>
      )}
    </div>
  );
};
