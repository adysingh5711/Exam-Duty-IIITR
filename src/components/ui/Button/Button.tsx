import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    className = '',
    disabled,
    ...props
}) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
        secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900 focus:ring-gray-500',
        danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
        ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-500',
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
    };

    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

    return (
        <button
            className={classes}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <LoadingSpinner size={size} />
            ) : (
                <>
                    {leftIcon && <span className="mr-2">{leftIcon}</span>}
                    {children}
                    {rightIcon && <span className="ml-2">{rightIcon}</span>}
                </>
            )}
        </button>
    );
};

interface LoadingSpinnerProps {
    size: ButtonProps['size'];
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size }) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6',
    };

    return (
        <svg
            className={`animate-spin ${sizeClasses[size || 'md']}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    );
};

export default Button;