'use client';

import * as React from 'react';
import {
  motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring,
  type HTMLMotionProps,
} from 'motion/react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EclipseButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  text?: string;
  children?: React.ReactNode;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variants = {
  primary: { base: 'bg-[#090d16] text-white border-[#090d16]', overlay: 'bg-white text-[#090d16]' },
  outline: { base: 'bg-transparent text-[#0A1128] border-slate-300', overlay: 'bg-white text-[#0A1128]' },
  ghost: { base: 'bg-transparent text-slate-600 border-transparent', overlay: 'bg-white text-[#0A1128]' },
  destructive: { base: 'bg-red-600 text-white border-red-600', overlay: 'bg-white text-red-600' },
};
const sizes = {
  default: 'min-h-12 px-8 py-3 text-sm',
  sm: 'min-h-10 px-5 py-2 text-xs',
  lg: 'min-h-16 px-10 py-4 text-base',
  icon: 'h-10 w-10 min-h-10 p-0',
};

// Based on the supplied EclipseButton. Both visual layers share the same label;
// only the base is announced. Pointer motion never changes the layout box.
export const EclipseButton = React.forwardRef<HTMLButtonElement, EclipseButtonProps>(
  function EclipseButton({
    text, children, variant = 'primary', size = 'default', isLoading = false,
    leftIcon, rightIcon, className, disabled, type = 'button', style,
    onPointerMove, onPointerEnter, onPointerLeave, ...props
  }, forwardedRef) {
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const reduceMotion = useReducedMotion();
    const blocked = Boolean(disabled || isLoading);
    const filterId = `eclipse-noise-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const maskX = useSpring(mouseX, { stiffness: 250, damping: 25 });
    const maskY = useSpring(mouseY, { stiffness: 250, damping: 25 });
    const offsetX = useSpring(0, { stiffness: 250, damping: 25 });
    const offsetY = useSpring(0, { stiffness: 250, damping: 25 });
    const radius = useSpring(0, { stiffness: 250, damping: 30 });
    const clipPath = useMotionTemplate`circle(${radius}px at ${maskX}px ${maskY}px)`;
    const current = variants[variant];
    const label = text ?? children;

    const setRef = React.useCallback((node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }, [forwardedRef]);

    const reset = React.useCallback(() => {
      radius.set(0);
      offsetX.set(0);
      offsetY.set(0);
    }, [radius, offsetX, offsetY]);

    React.useEffect(() => {
      if (blocked || reduceMotion) reset();
    }, [blocked, reduceMotion, reset]);

    const followPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
      if (blocked || reduceMotion || event.pointerType !== 'mouse' || !buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      mouseX.set(x);
      mouseY.set(y);
      offsetX.set(Math.max(-6, Math.min(6, (x - rect.width / 2) * 0.12)));
      offsetY.set(Math.max(-3, Math.min(3, (y - rect.height / 2) * 0.12)));
    };

    const content = () => (
      <span className="inline-flex min-w-0 items-center justify-center gap-2">
        {isLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {!isLoading && leftIcon && <span className="inline-flex shrink-0" aria-hidden="true">{leftIcon}</span>}
        {label}
        {!isLoading && rightIcon && <span className="inline-flex shrink-0" aria-hidden="true">{rightIcon}</span>}
      </span>
    );

    return (
      <motion.button
        {...props}
        ref={setRef}
        type={type}
        disabled={blocked}
        aria-busy={isLoading || undefined}
        data-slot="eclipse-button"
        className={cn(
          'relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border',
          'font-normal uppercase tracking-normal transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-60',
          current.base, sizes[size], className,
        )}
        style={{ ...style, x: reduceMotion ? 0 : offsetX, y: reduceMotion ? 0 : offsetY }}
        whileTap={blocked || reduceMotion ? undefined : { scale: 0.97 }}
        onPointerMove={event => { onPointerMove?.(event); if (!event.defaultPrevented) followPointer(event); }}
        onPointerEnter={event => {
          onPointerEnter?.(event);
          if (!event.defaultPrevented && !blocked && !reduceMotion && event.pointerType === 'mouse') {
            followPointer(event);
            // Cover the farthest corner even when hovering near an edge.
            const rect = event.currentTarget.getBoundingClientRect();
            radius.set(Math.hypot(rect.width, rect.height) + 8);
          }
        }}
        onPointerLeave={event => { onPointerLeave?.(event); reset(); }}
      >
        <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true" focusable="false">
          <defs><filter id={filterId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 15 -2" />
            <feComposite operator="in" in2="SourceGraphic" result="monoNoise" />
            <feBlend in="SourceGraphic" in2="monoNoise" mode="screen" />
          </filter></defs>
        </svg>
        <span className="pointer-events-none relative z-10">{content()}</span>
        <motion.span
          aria-hidden="true"
          className={cn('pointer-events-none absolute inset-0 z-20 flex select-none items-center justify-center', current.overlay)}
          style={{ clipPath, WebkitClipPath: clipPath, padding: 'inherit' }}
        >
          <span className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay" style={{ filter: `url(#${filterId})` }} />
          <span className="relative">{content()}</span>
        </motion.span>
      </motion.button>
    );
  },
);
