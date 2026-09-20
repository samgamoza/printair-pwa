/** Share through the phone's own share sheet (Messenger, Viber, SMS…); copy to the clipboard where there isn't one. */
export async function shareText(data: { title?: string; text: string; url?: string }): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share(data);
      return 'shared';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'shared'; // they closed the sheet: not an error
  }
  try {
    await navigator.clipboard.writeText([data.text, data.url].filter(Boolean).join('\n'));
    return 'copied';
  } catch {
    return 'failed';
  }
}

export async function shareImage(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return 'shared';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
