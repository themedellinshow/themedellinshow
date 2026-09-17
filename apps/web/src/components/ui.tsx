import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { IconStar } from './Icons';

type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'sm' | 'block';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant === 'primary' && 'btn-primary',
    variant === 'accent' && 'btn-accent',
    variant === 'outline' && 'btn-outline',
    variant === 'ghost' && 'btn-ghost',
    variant === 'danger' && 'btn-danger-ghost',
    size === 'sm' && 'btn-sm',
    size === 'block' && 'btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" style={{ width: 16, height: 16, margin: 0, borderWidth: 2 }} />}
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => <input ref={ref} className={`input ${className}`} {...rest} />,
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...rest }, ref) => <textarea ref={ref} className={`textarea ${className}`} {...rest} />,
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', ...rest }, ref) => <select ref={ref} className={`select ${className}`} {...rest} />,
);
Select.displayName = 'Select';

interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, hint, children, className = '' }: FieldProps) {
  return (
    <div className={`field ${className}`}>
      <label>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function RatingStars({ rating, count }: { rating: number | null | undefined; count?: number }) {
  const r = rating ?? 0;
  const full = Math.round(r);
  return (
    <span className="stars">
      {'★'.repeat(Math.max(0, Math.min(5, full)))}
      {'☆'.repeat(Math.max(0, 5 - Math.min(5, full)))}
      {count !== undefined && count > 0 ? ` (${count})` : ''}
    </span>
  );
}

export function TitleIcon({ children }: { children: React.ReactNode }) {
  return <span className="topbar-icon">{children}</span>;
}

export function Spinner() {
  return <div className="spinner" />;
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <p style={{ fontWeight: 700 }}>{title}</p>
      {message ? <p style={{ color: 'var(--color-text-muted)' }}>{message}</p> : null}
      {action}
    </div>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, color: 'var(--color-warning)' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <IconStar key={i} width={14} height={14} opacity={i <= Math.round(value) ? 1 : 0.25} />
      ))}
    </span>
  );
}