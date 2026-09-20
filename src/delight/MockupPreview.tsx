import { useEffect, useState } from 'react';

/**
 * "See it before you print it": drops the customer's logo or artwork onto simple drawings of a cup,
 * a box and a paper bag. It is an illustration to get excited about, not a print proof — the
 * caption says so — and it all happens on the device: the file is never uploaded for this.
 */
const PRODUCTS = [
  { key: 'cup', label: 'Cup' },
  { key: 'box', label: 'Box' },
  { key: 'bag', label: 'Paper bag' },
] as const;
type ProductKey = (typeof PRODUCTS)[number]['key'];

export function MockupPreview({ file }: { file: File }) {
  const [product, setProduct] = useState<ProductKey>('cup');
  // Made inside the effect, not in useMemo: React runs effects twice while developing, and an address
  // that was revoked by the first clean-up would leave a broken picture.
  const [url, setUrl] = useState('');
  useEffect(() => {
    const made = URL.createObjectURL(file);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [file]);

  return (
    <div className="rounded-3xl bg-ink-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-ink-950">Preview on a product</p>
        <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-ink-900/10" role="tablist" aria-label="Product">
          {PRODUCTS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={product === p.key}
              onClick={() => setProduct(p.key)}
              className={`min-h-8 rounded-full px-3 text-xs font-bold ${product === p.key ? 'bg-ink-950 text-white' : 'text-ink-600'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox="0 0 320 240" className="mt-3 w-full rounded-2xl bg-white" role="img" aria-label={`Your artwork on a ${product}`}>
        <defs>
          <linearGradient id="mk-shade" x1="0" x2="1">
            <stop offset="0" stopColor="#000" stopOpacity=".10" />
            <stop offset=".35" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".14" />
          </linearGradient>
          <clipPath id="mk-cup"><path d="M112 78h96l-10 124a10 10 0 0 1-10 9h-56a10 10 0 0 1-10-9z" /></clipPath>
        </defs>
        <ellipse cx="160" cy="218" rx="92" ry="9" fill="#19162a" opacity=".08" />

        {product === 'cup' && (
          <g>
            <path d="M104 62h112a6 6 0 0 1 6 6v6a4 4 0 0 1-4 4H102a4 4 0 0 1-4-4v-6a6 6 0 0 1 6-6z" fill="#2a263d" />
            <path d="M112 78h96l-10 124a10 10 0 0 1-10 9h-56a10 10 0 0 1-10-9z" fill="#f4ede2" />
            <path d="M115 112h90l-5.5 62h-79z" fill="#c9a77c" />
            <g clipPath="url(#mk-cup)">
              <image href={url} x="126" y="116" width="68" height="54" preserveAspectRatio="xMidYMid meet" />
              <rect x="108" y="78" width="104" height="134" fill="url(#mk-shade)" />
            </g>
          </g>
        )}

        {product === 'box' && (
          <g>
            <path d="M70 96l90-30 90 30-90 30z" fill="#e2c49a" />
            <path d="M70 96v86l90 32v-88z" fill="#d3b184" />
            <path d="M250 96v86l-90 32v-88z" fill="#c4a072" />
            <path d="M160 66v60" stroke="#b08d5f" strokeWidth="2" opacity=".5" />
            <g transform="matrix(1 .355 0 1 84 110)">
              <image href={url} x="0" y="0" width="62" height="62" preserveAspectRatio="xMidYMid meet" />
            </g>
          </g>
        )}

        {product === 'bag' && (
          <g>
            <path d="M128 66c0-30 64-30 64 0" fill="none" stroke="#8a6a44" strokeWidth="5" strokeLinecap="round" />
            <path d="M92 66h136l8 146H84z" fill="#d9bb8d" />
            <path d="M92 66h136l-10 14H102z" fill="#c8a877" />
            <image href={url} x="118" y="104" width="84" height="78" preserveAspectRatio="xMidYMid meet" />
            <path d="M92 66h136l8 146H84z" fill="url(#mk-shade)" />
          </g>
        )}
      </svg>
      <p className="mt-2 text-xs text-ink-500">Just for fun: a rough picture, not a print proof. Your printing partner confirms the real layout.</p>
    </div>
  );
}
