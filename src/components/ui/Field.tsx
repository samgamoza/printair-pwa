import { useId, type ReactNode, type HTMLInputTypeAttribute } from 'react';
import type { LucideIcon } from 'lucide-react';

function Label({ htmlFor, children, required }: { htmlFor?: string; children: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold text-ink-800">
      {children}
      {required && <span className="ml-0.5 text-magenta-600">*</span>}
    </label>
  );
}

/** Wraps any control with its label, hint and error line. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  action,
  children,
  className = '',
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  /** Small control shown opposite the label, e.g. an "I'm not sure" toggle. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {(label || action) && (
        <div className="flex items-end justify-between gap-3">
          {label ? (
            <Label htmlFor={htmlFor} required={required}>
              {label}
            </Label>
          ) : (
            <span />
          )}
          {action && <div className="mb-1.5">{action}</div>}
        </div>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-danger-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

type TextFieldProps = {
  label?: ReactNode;
  value: string;
  /** Every form in the app works with plain strings, so the change handler does too. */
  onChange: (value: string) => void;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  name?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email';
  icon?: LucideIcon;
  min?: number | string;
  className?: string;
};

export function TextField({ label, value, onChange, hint, error, required, icon: Icon, className, ...input }: TextFieldProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />}
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          aria-invalid={error ? true : undefined}
          className={`control ${Icon ? 'pl-12' : ''} ${error ? 'border-danger-500 focus:border-danger-600' : ''}`}
          {...input}
        />
      </div>
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  error,
  required,
  rows = 3,
  placeholder,
  className,
  autoFocus,
}: {
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`control resize-none ${error ? 'border-danger-500' : ''}`}
      />
    </Field>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
  hint,
  error,
  required,
  className,
}: {
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="control appearance-none bg-[length:1.25rem] bg-[right_1rem_center] bg-no-repeat pr-11" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23716b8c' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
        {children}
      </select>
    </Field>
  );
}

/** A selectable pill, for multi-select lists like print categories and specialties. */
export function Chip({
  selected,
  onClick,
  children,
  title,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={selected}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-all active:scale-95 ${
        selected ? 'bg-ink-950 text-white' : 'bg-white text-ink-700 ring-2 ring-inset ring-ink-200 hover:ring-ink-400'
      }`}
    >
      {children}
    </button>
  );
}

/** Two- or three-way choice shown as one control, e.g. Yes / No. */
export function Segmented<T extends string | boolean>({
  value,
  onChange,
  options,
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-full bg-ink-100 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`min-h-9 rounded-full px-5 text-sm font-bold transition-all ${
            value === o.value ? 'bg-white text-ink-950 shadow-soft' : 'text-ink-500 hover:text-ink-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border-2 border-ink-200 bg-white px-4 py-3 text-left"
    >
      <span className="font-bold text-ink-800">{label}</span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-leaf-500' : 'bg-ink-200'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}
