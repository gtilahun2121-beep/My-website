'use client';

import { useState } from 'react';

interface PasswordInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    error?: string;
    hint?: string;
    icon?: string;
    maxLength?: number;
    disabled?: boolean;
    autoComplete?: string;
    name?: string;
}

const EyeIcon: React.FC<{ open: boolean; className?: string }> = ({ open, className }) =>
  open ? (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

export default function PasswordInput({
    label,
    value,
    onChange,
    placeholder,
    error,
    hint,
    icon,
    maxLength,
    disabled = false,
    autoComplete,
    name,
}: PasswordInputProps) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="flex flex-col gap-1">
            {label && <label className="block text-sm font-bold text-gray-700">{label}</label>}

            <div className="relative flex items-center">
                {icon && (
                    <span className="absolute left-3 text-base select-none pointer-events-none">
                        {icon}
                    </span>
                )}
                <input
                    type={showPassword ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    name={name}
                    className={[
                        'w-full py-2.5 rounded-lg border text-sm transition-colors duration-150',
                        'focus:outline-none focus:ring-2',
                        icon ? 'pl-10' : 'px-4',
                        'pr-11',
                        disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white',
                        error
                            ? 'border-amber-400 focus:ring-amber-300'
                            : 'border-gray-300 focus:ring-[#314fa0] focus:border-[#314fa0]',
                    ].join(' ')}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 p-1 rounded-full text-gray-400 hover:text-[#314fa0] hover:bg-gray-100 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                >
                    <EyeIcon open={showPassword} />
                </button>
            </div>

            {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
            {error && <p className="text-xs text-amber-600 font-medium">{error}</p>}
        </div>
    );
}