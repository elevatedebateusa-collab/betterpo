import * as React from 'react';
import { RadioGroup } from 'radix-ui';
import { cn } from '@/lib/utils';
import { tabsListVariants, tabsTriggerVariants } from './tabs';

type SelectionVariant = 'default' | 'button' | 'line';

export interface SelectionOption<T extends string> {
  value: T;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  title?: string;
}

interface SelectionGroupProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SelectionOption<T>[];
  'aria-label': string;
  size?: 'lg' | 'md' | 'sm' | 'xs';
  variant?: SelectionVariant;
  shape?: 'default' | 'pill';
  className?: string;
  itemClassName?: string;
  disabled?: boolean;
  /** Preserve action semantics for presets that can be selected again. */
  onReselect?: (value: T) => void;
}

// A single-choice adapter for the supplied tab styles. Settings and filters
// keep radio semantics instead of announcing tabs with nonexistent panels.
export function SelectionGroup<T extends string>({
  value, onValueChange, options, size = 'sm', variant = 'default',
  shape = 'default', className, itemClassName, onReselect, disabled,
  'aria-label': label,
}: SelectionGroupProps<T>) {
  const id = React.useId();
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={next => {
        const option = options.find(item => item.value === next && !item.disabled);
        if (option) onValueChange(option.value);
      }}
      aria-label={label}
      orientation="horizontal"
      disabled={disabled}
      className={cn('selection-group max-w-full flex-wrap', tabsListVariants({ variant, shape, size }), className)}
      data-variant={variant}
      data-slot="selection-group"
    >
      {options.map((option, index) => (
        <RadioGroup.Item
          type="button"
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          title={option.title}
          aria-label={option.title}
          aria-labelledby={option.title ? undefined : `${id}-label-${index}`}
          aria-describedby={option.description ? `${id}-${index}` : undefined}
          onClick={() => { if (value === option.value) onReselect?.(option.value); }}
          className={cn(tabsTriggerVariants({ variant, size }), option.description && 'flex-col items-start whitespace-normal text-left', itemClassName)}
          data-slot="selection-trigger"
        >
          <span id={`${id}-label-${index}`} className="inline-flex items-center justify-center gap-1.5">{option.label}</span>
          {option.description && <span id={`${id}-${index}`} className="text-[11px] leading-relaxed text-muted-foreground">{option.description}</span>}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
