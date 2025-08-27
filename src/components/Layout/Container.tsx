import React from 'react';

interface ContainerProps {
    children: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    className?: string;
}

export const Container: React.FC<ContainerProps> = ({
    children,
    maxWidth = 'xl',
    className = '',
}) => {
    const maxWidthClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        full: 'max-w-full',
    };

    const classes = `mx-auto px-4 sm:px-6 lg:px-8 ${maxWidthClasses[maxWidth]} ${className}`;

    return <div className={classes}>{children}</div>;
};

export default Container;