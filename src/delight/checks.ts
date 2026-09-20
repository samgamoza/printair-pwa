/** Small yes/no questions the delight components ask. Kept out of the component files so fast refresh stays happy. */

export const ORDER_STAGES = ['CONFIRMED', 'IN_PRODUCTION', 'READY', 'DELIVERED'] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

/** Is this an order status the delivery-style progress bar can tell a story about? */
export function isTrackable(status: string): status is OrderStage {
  return (ORDER_STAGES as readonly string[]).includes(status);
}

/** Can this file be shown on the product mockups? (An image the browser can draw; never a PDF.) */
export function isPreviewable(file: File | null): file is File {
  return Boolean(file && /^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type));
}
