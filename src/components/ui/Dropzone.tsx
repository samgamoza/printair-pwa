import { useRef, useState, type ReactNode } from 'react';
import { UploadCloud } from 'lucide-react';

/** Tap-or-drop file picker. Validation stays with the caller, which knows the rules for its bucket. */
export function Dropzone({
  onFiles,
  accept,
  multiple = false,
  title,
  hint,
  disabled,
  busy,
  tone = 'cyan',
}: {
  onFiles: (files: FileList | null) => void;
  accept: string;
  multiple?: boolean;
  title: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'cyan' | 'magenta' | 'sun';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const tints = {
    cyan: 'hover:border-cyan-400 hover:bg-cyan-50',
    magenta: 'hover:border-magenta-400 hover:bg-magenta-50',
    sun: 'hover:border-sun-500 hover:bg-sun-50',
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          // Clearing lets the same file be picked again after it was removed.
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (disabled || busy) return;
          onFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-3xl border-2 border-dashed px-5 py-7 text-center transition-colors disabled:opacity-60 ${
          over ? 'border-ink-900 bg-ink-50' : `border-ink-300 bg-white ${tints[tone]}`
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-700">
          <UploadCloud className="h-6 w-6" />
        </span>
        <span className="mt-1 font-bold text-ink-900">{busy ? 'Uploading…' : title}</span>
        {hint && <span className="text-sm text-ink-500">{hint}</span>}
      </button>
    </>
  );
}
