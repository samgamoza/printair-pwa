import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { InkLoader } from './Marks';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dark' | 'light';
export type ButtonSize = 'sm' | 'md' | 'lg';

type CommonProps = {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
};

type ButtonProps = CommonProps & {
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** Shows the ink loader in place of the label and blocks clicks. */
  loading?: boolean;
  'aria-label'?: string;
};

const base =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition-[transform,background-color,box-shadow,color] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-ink-950 text-white shadow-soft hover:bg-ink-800',
  dark: 'bg-ink-950 text-white shadow-soft hover:bg-ink-800',
  accent: 'bg-magenta-600 text-white shadow-magenta hover:bg-magenta-700',
  secondary: 'bg-white text-ink-900 ring-2 ring-inset ring-ink-200 hover:ring-ink-900',
  outline: 'bg-transparent text-ink-900 ring-2 ring-inset ring-ink-200 hover:ring-ink-900',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100',
  danger: 'bg-danger-50 text-danger-700 ring-2 ring-inset ring-danger-100 hover:bg-danger-100',
  light: 'bg-white text-ink-950 shadow-soft hover:bg-ink-50',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-4 text-sm',
  md: 'min-h-11 px-5 text-[0.95rem]',
  lg: 'min-h-14 px-7 text-base',
};

function classes({ variant = 'primary', size = 'md', fullWidth, className = '' }: CommonProps) {
  return `${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`;
}

export function Button({
  children,
  onClick,
  type = 'button',
  disabled,
  loading,
  icon,
  iconRight,
  'aria-label': ariaLabel,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      data-variant={rest.variant ?? 'primary'}
      className={classes(rest)}
    >
      {loading ? (
        <InkLoader tone="current" className="[&>span]:h-2 [&>span]:w-2" />
      ) : (
        <>
          {icon}
          {children}
          {iconRight}
        </>
      )}
    </button>
  );
}

/** Same look, but a router link. */
export function ButtonLink({ to, children, icon, iconRight, ...rest }: CommonProps & { to: string }) {
  return (
    <Link to={to} data-variant={rest.variant ?? 'primary'} className={classes(rest)}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

export function IconButton({
  children,
  onClick,
  label,
  className = '',
  tone = 'plain',
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  className?: string;
  tone?: 'plain' | 'solid' | 'onDark';
}) {
  const tones = {
    plain: 'bg-ink-100 text-ink-700 hover:bg-ink-200',
    solid: 'bg-ink-950 text-white hover:bg-ink-800',
    onDark: 'bg-white/10 text-white hover:bg-white/20',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}
