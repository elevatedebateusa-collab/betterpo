'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EclipseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
  children?: React.ReactNode;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variants = {
  primary: 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white border-transparent shadow-sm eclipse-btn-primary',
  outline: 'bg-white text-emerald-600 border-slate-200 hover:border-emerald-500/40 hover:bg-emerald-50 active:bg-emerald-100',
  ghost: 'bg-transparent text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/70',
  destructive: 'bg-red-600 hover:bg-red-700 text-white border-transparent',
};

const sizes = {
  default: 'min-h-12 px-7 py-3 text-sm font-medium',
  sm: 'min-h-9 px-4 py-1.5 text-xs font-medium',
  lg: 'min-h-14 px-9 py-3.5 text-base font-semibold',
  icon: 'h-10 w-10 min-h-10 p-0',
};

export const EclipseButton = React.forwardRef<HTMLButtonElement, EclipseButtonProps>(
  function EclipseButton({
    text,
    children,
    variant = 'primary',
    size = 'default',
    isLoading = false,
    leftIcon,
    rightIcon,
    className,
    disabled,
    type = 'button',
    ...props
  }, ref) {
    const blocked = Boolean(disabled || isLoading);
    const label = text ?? children;

    return (
      <button
        ref={ref}
        type={type}
        disabled={blocked}
        aria-busy={isLoading || undefined}
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center rounded-full border',
          'font-sans font-medium tracking-normal transition-all duration-150 select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        <span className="inline-flex min-w-0 items-center justify-center gap-2">
          {isLoading && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          )}
          {!isLoading && leftIcon && (
            <span className="inline-flex shrink-0" aria-hidden="true">{leftIcon}</span>
          )}
          {label}
          {!isLoading && rightIcon && (
            <span className="inline-flex shrink-0" aria-hidden="true">{rightIcon}</span>
          )}
        </span>
      </button>
    );
  }
);

EclipseButton.displayName = 'EclipseButton';
