'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface FormButtonProps {
    onClick?: () => void;
    loading?: boolean;
    disabled?: boolean;
    variant?: ButtonVariant;
    type?: 'button' | 'submit' | 'reset';
    icon?: string;
    children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary:
        'bg-[#001f3f] text-[#00d9ff] hover:bg-[#001f3f] active:scale-[0.98]',
    secondary:
        'border-2 border-[#001f3f] text-[#00d9ff] bg-white hover:bg-gray-50 active:scale-[0.98]',
    danger:
        'bg-[#001f3f] text-[#00d9ff] hover:bg-[#a50e1f] active:scale-[0.98]',
};

export default function FormButton({
    onClick,
    loading = false,
    disabled = false,
    variant = 'primary',
    type = 'button',
    icon,
    children,
}: FormButtonProps) {
    const isDisabled = disabled || loading;

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={isDisabled}
            className={[
                'w-full py-3 px-4 rounded-lg font-bold text-sm transition-all duration-200',
                'flex items-center justify-center gap-2',
                variantStyles[variant],
                isDisabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : '',
            ].join(' ')}
        >
            {loading ? (
                <svg
                    className="animate-spin h-4 w-4 flex-shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                </svg>
            ) : (
                icon && <span className="flex-shrink-0">{icon}</span>
            )}
            {children}
        </button>
    );
}

