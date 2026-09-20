import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Share2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useDialogs } from '@/components/ui/dialogs';
import { shareImage } from './share';

/**
 * A ready-to-post picture for Stories and feeds once an order is delivered. The customer's own
 * business is the hero: their photo (optional), what they had made, their words. PrintAir is a
 * small line at the bottom. Drawn on a canvas on the device; nothing is uploaded.
 */
const W = 1080;
const H = 1920;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function draw(canvas: HTMLCanvasElement, opts: { title: string; category: string; caption: string; photo: HTMLImageElement | null }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  await document.fonts?.ready;
  const display = getComputedStyle(document.documentElement).getPropertyValue('--font-display') || 'sans-serif';
  const sans = getComputedStyle(document.documentElement).getPropertyValue('--font-sans') || 'sans-serif';

  ctx.fillStyle = '#f6f5fa';
  ctx.fillRect(0, 0, W, H);

  // halftone corner
  ctx.fillStyle = '#ffd21f';
  for (let y = 0; y < 520; y += 34) for (let x = W - 520; x < W; x += 34) {
    ctx.beginPath();
    ctx.arc(x + 17, y + 17, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // photo (or a tinted block when there isn't one)
  const px = 90, py = 260, pw = W - 180, ph = 900, r = 64;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, r);
  ctx.clip();
  if (opts.photo) {
    const s = Math.max(pw / opts.photo.width, ph / opts.photo.height);
    const dw = opts.photo.width * s, dh = opts.photo.height * s;
    ctx.drawImage(opts.photo, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(px, py, px + pw, py + ph);
    g.addColorStop(0, '#63d4fb');
    g.addColorStop(0.55, '#9078fb');
    g.addColorStop(1, '#fb5aa9');
    ctx.fillStyle = g;
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = `800 120px ${display}`;
    ctx.textAlign = 'center';
    wrap(ctx, opts.title, pw - 160).slice(0, 3).forEach((l, i) => ctx.fillText(l, W / 2, py + ph / 2 - 40 + i * 130));
    ctx.textAlign = 'left';
  }
  ctx.restore();

  // category chip
  ctx.font = `800 34px ${sans}`;
  const chip = opts.category.toUpperCase();
  const cw = ctx.measureText(chip).width + 64;
  ctx.fillStyle = '#0f0d1a';
  ctx.beginPath();
  ctx.roundRect(px, 150, cw, 72, 36);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(chip, px + 32, 198);

  // title + caption
  ctx.fillStyle = '#0f0d1a';
  ctx.font = `800 92px ${display}`;
  let y = py + ph + 130;
  for (const l of wrap(ctx, opts.title, pw).slice(0, 2)) {
    ctx.fillText(l, px, y);
    y += 104;
  }
  ctx.fillStyle = '#403b57';
  ctx.font = `500 50px ${sans}`;
  y += 10;
  for (const l of wrap(ctx, opts.caption, pw).slice(0, 4)) {
    ctx.fillText(l, px, y);
    y += 68;
  }

  // footer: colour bar + credit
  const inks = ['#22bdf0', '#ee2a8b', '#ffd21f', '#0f0d1a'];
  inks.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.roundRect(px + i * 66, H - 150, 54, 22, 6);
    ctx.fill();
  });
  ctx.fillStyle = '#716b8c';
  ctx.font = `700 40px ${sans}`;
  ctx.textAlign = 'right';
  ctx.fillText('Printed via PrintAir', W - px, H - 128);
  ctx.textAlign = 'left';
}

export function ShareCardSheet({ open, onClose, title, category }: { open: boolean; onClose: () => void; title: string; category: string }) {
  const { toast } = useDialogs();
  const canvas = useRef<HTMLCanvasElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [caption, setCaption] = useState('Fresh from the press! Our new prints just arrived.');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && canvas.current) void draw(canvas.current, { title, category, caption, photo });
  }, [open, title, category, caption, photo]);

  function pick(list: FileList | null) {
    const f = list?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      URL.revokeObjectURL(url);
      setPhoto(img);
    };
    img.src = url;
  }

  async function share() {
    if (!canvas.current) return;
    setBusy(true);
    try {
      const blob = await new Promise<Blob | null>((res) => canvas.current!.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) throw new Error('no image');
      const how = await shareImage(blob, 'printair-delivered.jpg', `${caption} #PrintAir`);
      if (how === 'downloaded') toast('Saved to your downloads. Post it anywhere!', 'success');
    } catch {
      toast("Couldn't make the picture on this device.", 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} size="sm" labelledBy="share-card-title">
      <div className="px-6 pb-8 pt-6 sm:px-8 sm:pt-8">
        <h2 id="share-card-title" className="pr-12 text-2xl text-ink-950">
          Show it off
        </h2>
        <p className="mt-2 text-ink-600">A ready-to-post picture for your Stories. Add a photo of the real thing to make it yours.</p>
        <canvas ref={canvas} width={W} height={H} className="mx-auto mt-5 w-48 rounded-2xl shadow-card ring-1 ring-ink-900/10" />
        <input ref={picker} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files)} />
        <label className="mt-5 block text-sm font-bold text-ink-800" htmlFor="share-caption">
          Your caption
        </label>
        <textarea id="share-caption" rows={2} maxLength={140} value={caption} onChange={(e) => setCaption(e.target.value)} className="control mt-1.5" />
        <div className="mt-5 flex gap-2.5">
          <Button variant="secondary" size="lg" icon={<ImagePlus className="h-5 w-5" />} onClick={() => picker.current?.click()}>
            {photo ? 'Change photo' : 'Add photo'}
          </Button>
          <Button variant="accent" size="lg" fullWidth loading={busy} icon={<Share2 className="h-5 w-5" />} onClick={share}>
            Share
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
