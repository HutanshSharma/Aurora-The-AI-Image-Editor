import { forwardRef, useId } from 'react';
import { cn } from './cn';

const Input = forwardRef(function Input(
  { label, hint, error, leading, trailing, className, wrapperClassName, id, ...props },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;

  return (
    <div className={cn('w-full', wrapperClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-[13px] font-medium text-muted"
        >
          {label}
        </label>
      )}

      <div
        className={cn(
          'group flex items-center gap-2 rounded-2xl border bg-surface-2 px-3.5 transition-colors',
          'focus-within:border-accent/70 focus-within:bg-surface-2',
          error ? 'border-danger/60' : 'border-line hover:border-line-strong',
        )}
      >
        {leading && <span className="text-faint">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-11 w-full bg-transparent text-[15px] text-ink placeholder:text-faint',
            'outline-none autofill:bg-transparent',
            className,
          )}
          {...props}
        />
        {trailing && <span className="text-faint">{trailing}</span>}
      </div>

      {error ? (
        <p className="mt-1.5 text-[12px] text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-faint">{hint}</p>
      ) : null}
    </div>
  );
});

export default Input;
