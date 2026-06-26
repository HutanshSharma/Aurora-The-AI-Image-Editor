import { cn } from './cn';

const base =
  'inline-flex items-center justify-center shrink-0 rounded-2xl ' +
  'transition-all duration-200 ease-out active:scale-90 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ' +
  'disabled:opacity-40 disabled:pointer-events-none';

const variants = {
  ghost: 'text-muted hover:text-ink hover:bg-white/8',
  surface: 'bg-surface-2 text-ink border border-line hover:bg-surface-3',
  accent: 'bg-accent text-white shadow-glow hover:bg-accent-hover active:bg-accent-press',
  glass: 'glass text-ink border border-line hover:border-line-strong',
  danger: 'text-danger hover:bg-danger/15',
};

const sizes = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-12 w-12',
};

export default function IconButton({
  variant = 'ghost',
  size = 'md',
  label,
  className,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(base, variants[variant] ?? variants.ghost, sizes[size] ?? sizes.md, className)}
      {...props}
    />
  );
}
