import { cn } from './cn';

const base =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none ' +
  'transition-all duration-200 ease-out active:scale-[0.97] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const variants = {
  primary:
    'bg-accent text-white shadow-soft hover:bg-accent-hover active:bg-accent-press',
  secondary:
    'bg-surface-2 text-ink border border-line hover:bg-surface-3 hover:border-line-strong',
  ghost: 'text-muted hover:text-ink hover:bg-white/5',
  outline: 'border border-line text-ink hover:bg-white/5 hover:border-line-strong',
  danger:
    'bg-danger/15 text-danger border border-danger/25 hover:bg-danger/25',
  glass: 'glass text-ink border border-line hover:border-line-strong',
};

const sizes = {
  sm: 'h-9 px-3.5 text-[13px] rounded-xl',
  md: 'h-11 px-4 text-sm rounded-2xl',
  lg: 'h-12 px-5 text-[15px] rounded-2xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        base,
        variants[variant] ?? variants.primary,
        sizes[size] ?? sizes.md,
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  );
}
