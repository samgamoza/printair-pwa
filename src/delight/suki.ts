/**
 * Suki status. "Suki" is the Filipino word for a regular — the customer a shop knows by name.
 * It is earned by orders actually delivered, nothing else, and for now it is recognition only:
 * a badge and a progress bar. It deliberately promises no discounts or priority, because those are
 * business rules the owner has not set and the backend does not yet enforce (docs/BACKEND-FOLLOWUPS.md).
 */
export type SukiTier = { key: 'new' | 'suki' | 'super'; label: string; at: number; tint: string };

export const SUKI_TIERS: SukiTier[] = [
  { key: 'new', label: 'Ka-negosyo', at: 0, tint: 'bg-cyan-200' },
  { key: 'suki', label: 'Suki', at: 3, tint: 'bg-sun-300' },
  { key: 'super', label: 'Super Suki', at: 10, tint: 'bg-magenta-300' },
];

export function sukiFor(delivered: number) {
  const tier = [...SUKI_TIERS].reverse().find((t) => delivered >= t.at) ?? SUKI_TIERS[0];
  const next = SUKI_TIERS.find((t) => t.at > delivered) ?? null;
  const floor = tier.at;
  const progress = next ? (delivered - floor) / (next.at - floor) : 1;
  return { tier, next, toGo: next ? next.at - delivered : 0, progress };
}
