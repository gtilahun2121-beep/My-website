'use client';

interface FormInputProps {
    label: string;
    type?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    error?: string;
    hint?: string;
    icon?: string;
    maxLength?: number;
    disabled?: boolean;
    autoComplete?: string;
}

export default function FormInput({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    error,
    hint,
    icon,
    maxLength,
    disabled = false,
    autoComplete,
}: FormInputProps) {
    return (
        <div className="flex flex-col gap-1">
            <label className="block text-sm font-bold text-gray-700">
                {label}
            </label>

            <div className="relative flex items-center">
                {icon && (
                    <span className="absolute left-3 text-base select-none pointer-events-none">
                        {icon}
                    </span>
                )}
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    className={[
                        'w-full py-2.5 rounded-lg border text-sm transition-colors duration-150',
                        'focus:outline-none focus:ring-2',
                        icon ? 'pl-10 pr-4' : 'px-4',
                        disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white',
                        error
                            ? 'border-red-400 focus:ring-red-300'
                            : 'border-gray-300 focus:ring-[#314fa0] focus:border-[#314fa0]',
                    ].join(' ')}
                />
            </div>

            {hint && !error && (
                <p className="text-xs text-gray-400">{hint}</p>
            )}

            {error && (
                <p className="text-xs text-red-500 font-medium">{error}</p>
            )}
        </div>
    );
}
