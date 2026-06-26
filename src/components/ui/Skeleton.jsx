import { cn } from './cn';

/** Shimmer placeholder for loading states. */
export default function Skeleton({ className }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-surface-2',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:animate-[shimmer_1.6s_infinite]',
        'before:bg-linear-to-r before:from-transparent before:via-white/8 before:to-transparent',
        className,
      )}
    />
  );
}
