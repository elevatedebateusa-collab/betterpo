import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot as SlotPrimitive } from 'radix-ui';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
  dotClassName?: string;
  disabled?: boolean;
}

export interface BadgeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof badgeButtonVariants> {
  asChild?: boolean;
}

export type BadgeDotProps = React.HTMLAttributes<HTMLSpanElement>;

const badgeVariants = cva(
  'inline-flex items-center justify-center border border-transparent font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&_svg]:-ms-px [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        success:
          'bg-[var(--color-success-accent,#22c55e)] text-[var(--color-success-foreground,#fff)]',
        warning:
          'bg-[var(--color-warning-accent,#eab308)] text-[var(--color-warning-foreground,#fff)]',
        info: 'bg-[var(--color-info-accent,#8b5cf6)] text-[var(--color-info-foreground,#fff)]',
        outline: 'bg-transparent border border-border text-secondary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
      },
      appearance: {
        default: '',
        light: '',
        outline: '',
        ghost: 'border-transparent bg-transparent',
      },
      disabled: {
        true: 'opacity-50 pointer-events-none',
      },
      size: {
        lg: 'rounded-md px-[0.5rem] h-7 min-w-7 gap-1.5 text-xs [&_svg]:size-3.5',
        md: 'rounded-md px-[0.45rem] h-6 min-w-6 gap-1.5 text-xs [&_svg]:size-3.5 ',
        sm: 'rounded-sm px-[0.325rem] h-5 min-w-5 gap-1 text-[0.6875rem] leading-[0.75rem] [&_svg]:size-3',
        xs: 'rounded-sm px-[0.25rem] h-4 min-w-4 gap-1 text-[0.625rem] leading-[0.5rem] [&_svg]:size-3',
      },
      shape: {
        default: '',
        circle: 'rounded-full',
      },
    },
    compoundVariants: [
      /* Light */
      {
        variant: 'primary',
        appearance: 'light',
        className:
          'text-[var(--color-primary-accent,#1d4ed8)] bg-[var(--color-primary-soft,#eff6ff)] dark:bg-[var(--color-primary-soft,#172554)] dark:text-[var(--color-primary-soft,#2563eb)]',
      },
      {
        variant: 'secondary',
        appearance: 'light',
        className: 'bg-secondary dark:bg-secondary/50 text-secondary-foreground',
      },
      {
        variant: 'success',
        appearance: 'light',
        className:
          'text-[var(--color-success-accent,#166534)] bg-[var(--color-success-soft,#dcfce7)] dark:bg-[var(--color-success-soft,#052e16)] dark:text-[var(--color-success-soft,#16a34a)]',
      },
      {
        variant: 'warning',
        appearance: 'light',
        className:
          'text-[var(--color-warning-accent,#a16207)] bg-[var(--color-warning-soft,#fef9c3)] dark:bg-[var(--color-warning-soft,#422006)] dark:text-[var(--color-warning-soft,#ca8a04)]',
      },
      {
        variant: 'info',
        appearance: 'light',
        className:
          'text-[var(--color-info-accent,#6d28d9)] bg-[var(--color-info-soft,#ede9fe)] dark:bg-[var(--color-info-soft,#2e1065)] dark:text-[var(--color-info-soft,#a78bfa)]',
      },
      {
        variant: 'destructive',
        appearance: 'light',
        className:
          'text-[var(--color-destructive-accent,#b91c1c)] bg-[var(--color-destructive-soft,#fef2f2)] dark:bg-[var(--color-destructive-soft,#450a0a)] dark:text-[var(--color-destructive-soft,#dc2626)]',
      },
      /* Outline */
      {
        variant: 'primary',
        appearance: 'outline',
        className:
          'text-[var(--color-primary-accent,#1d4ed8)] border-[var(--color-primary-soft,#dbeafe)] bg-[var(--color-primary-soft,#eff6ff)] dark:bg-[var(--color-primary-soft,#172554)] dark:border-[var(--color-primary-soft,#1e3a8a)] dark:text-[var(--color-primary-soft,#2563eb)]',
      },
      {
        variant: 'success',
        appearance: 'outline',
        className:
          'text-[var(--color-success-accent,#15803d)] border-[var(--color-success-soft,#bbf7d0)] bg-[var(--color-success-soft,#f0fdf4)] dark:bg-[var(--color-success-soft,#052e16)] dark:border-[var(--color-success-soft,#14532d)] dark:text-[var(--color-success-soft,#16a34a)]',
      },
      {
        variant: 'warning',
        appearance: 'outline',
        className:
          'text-[var(--color-warning-accent,#a16207)] border-[var(--color-warning-soft,#fef08a)] bg-[var(--color-warning-soft,#fefce8)] dark:bg-[var(--color-warning-soft,#422006)] dark:border-[var(--color-warning-soft,#713f12)] dark:text-[var(--color-warning-soft,#ca8a04)]',
      },
      {
        variant: 'info',
        appearance: 'outline',
        className:
          'text-[var(--color-info-accent,#6d28d9)] border-[var(--color-info-soft,#ede9fe)] bg-[var(--color-info-soft,#f5f3ff)] dark:bg-[var(--color-info-soft,#2e1065)] dark:border-[var(--color-info-soft,#4c1d95)] dark:text-[var(--color-info-soft,#a78bfa)]',
      },
      {
        variant: 'destructive',
        appearance: 'outline',
        className:
          'text-[var(--color-destructive-accent,#b91c1c)] border-[var(--color-destructive-soft,#fee2e2)] bg-[var(--color-destructive-soft,#fef2f2)] dark:bg-[var(--color-destructive-soft,#450a0a)] dark:border-[var(--color-destructive-soft,#7f1d1d)] dark:text-[var(--color-destructive-soft,#dc2626)]',
      },
      /* Ghost */
      {
        variant: 'primary',
        appearance: 'ghost',
        className: 'text-primary',
      },
      {
        variant: 'secondary',
        appearance: 'ghost',
        className: 'text-secondary-foreground',
      },
      {
        variant: 'success',
        appearance: 'ghost',
        className: 'text-[var(--color-success-accent,#22c55e)]',
      },
      {
        variant: 'warning',
        appearance: 'ghost',
        className: 'text-[var(--color-warning-accent,#eab308)]',
      },
      {
        variant: 'info',
        appearance: 'ghost',
        className: 'text-[var(--color-info-accent,#8b5cf6)]',
      },
      {
        variant: 'destructive',
        appearance: 'ghost',
        className: 'text-destructive',
      },

      { size: 'lg', appearance: 'ghost', className: 'px-0' },
      { size: 'md', appearance: 'ghost', className: 'px-0' },
      { size: 'sm', appearance: 'ghost', className: 'px-0' },
      { size: 'xs', appearance: 'ghost', className: 'px-0' },
    ],
    defaultVariants: {
      variant: 'primary',
      appearance: 'default',
      size: 'md',
    },
  },
);

const badgeButtonVariants = cva(
  'cursor-pointer transition-all inline-flex items-center justify-center leading-none size-3.5 [&>svg]:!opacity-100 [&>svg]:size-3.5 p-0 rounded-md -me-0.5 opacity-60 hover:opacity-100',
  {
    variants: {
      variant: {
        default: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  size,
  appearance,
  shape,
  asChild = false,
  disabled,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? SlotPrimitive.Slot : 'span';

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, appearance, shape, disabled }), className)}
      {...props}
    />
  );
}

function BadgeButton({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof badgeButtonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? SlotPrimitive.Slot : 'button';
  return (
    <Comp
      type={asChild ? undefined : 'button'}
      data-slot="badge-button"
      className={cn(badgeButtonVariants({ variant, className }))}
      role="button"
      {...props}
    />
  );
}

function BadgeDot({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="badge-dot"
      className={cn('size-1.5 rounded-full bg-[currentColor] opacity-75', className)}
      {...props}
    />
  );
}

export { Badge, BadgeButton, BadgeDot, badgeVariants };
