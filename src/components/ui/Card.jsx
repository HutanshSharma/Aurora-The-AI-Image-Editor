import { cn } from './cn';

const variants = {
  surface: 'bg-surface border border-line',
  raised: 'bg-surface-2 border border-line shadow-soft',
  glass: 'glass border border-line',
  ghost: 'bg-transparent',
};

export default function Card({
  as: Tag = 'div',
  variant = 'surface',
  className,
  ...props
}) {
  return (
    <Tag
      className={cn('rounded-2xl', variants[variant] ?? variants.surface, className)}
      {...props}
    />
  );
}
