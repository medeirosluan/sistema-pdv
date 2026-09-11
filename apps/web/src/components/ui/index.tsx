import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';
import type { LucideIcon } from 'lucide-react';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'dark';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  dark: 'bg-slate-900 text-white hover:bg-slate-800',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${buttonVariants[variant]} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ${className}`}
      {...props}
    />
  );
}

export function Card({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white ${className}`}
    >
      {children}
    </div>
  );
}

type BadgeTone =
  | 'slate'
  | 'emerald'
  | 'amber'
  | 'red'
  | 'sky'
  | 'violet';

const badgeTones: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-600',
  emerald: 'bg-brand-100 text-brand-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  sky: 'bg-sky-100 text-sky-700',
  violet: 'bg-violet-100 text-violet-700',
};

export function Badge({
  tone = 'slate',
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="mt-3 text-sm font-medium text-slate-700">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-slate-400">{description}</p>
      )}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
  );
}
