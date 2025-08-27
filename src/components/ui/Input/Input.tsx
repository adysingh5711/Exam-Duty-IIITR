import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    className = '',
    id,
    ...props
}) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const inputClasses = `
    block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400
    focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
    disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200 disabled:shadow-none
    ${error ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
    ${leftIcon ? 'pl-10' : ''}
    ${rightIcon ? 'pr-10' : ''}
    ${className}
  `;

    return (
        <div className="mb-4">
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-sm font-medium text-gray-700 mb-2"
                >
                    {label}
                </label>
            )}

            <div className="relative">
                {leftIcon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 sm:text-sm">{leftIcon}</span>
                    </div>
                )}

                <input
                    id={inputId}
                    className={inputClasses}
                    {...props}
                />

                {rightIcon && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 sm:text-sm">{rightIcon}</span>
                    </div>
                )}
            </div>

            {error && (
                <p className="mt-1 text-sm text-red-600" id={`${inputId}-error`}>
                    {error}
                </p>
            )}

            {helperText && !error && (
                <p className="mt-1 text-sm text-gray-500" id={`${inputId}-description`}>
                    {helperText}
                </p>
            )}
        </div>
    );
};

export default Input;