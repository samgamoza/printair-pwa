/**
 * Seasonal kits: the times of year Filipino businesses print the most, each with the date an order
 * should be in by so it arrives on time. A kit is only a shortcut — it opens the project builder on
 * the right category with a head start on the brief. Dates repeat every year.
 *
 * `orderBy` and `day` are [month, day]. A kit shows from `leadDays` before its order-by date until
 * that date passes. Lead times are cautious rules of thumb for print production; tune them with
 * real partner turnaround once there is data.
 */
export type SeasonKit = {
  id: string;
  name: string;
  taglish: string;
  blurb: string;
  categoryId: string;
  /** The day itself. */
  day: [number, number];
  /** Post the project by this date. */
  orderBy: [number, number];
  leadDays: number;
  tint: string;
  emoji: string;
};

export const SEASON_KITS: SeasonKit[] = [
  { id: 'christmas', name: 'Christmas packaging', taglish: 'Ber months na! Christmas packaging', blurb: 'Gift boxes, tags, paper bags and stickers for the holiday rush.', categoryId: 'product', day: [12, 25], orderBy: [11, 15], leadDays: 75, tint: 'bg-leaf-200', emoji: '🎄' },
  { id: '1111', name: '11.11 seller pack', taglish: '11.11 seller pack', blurb: 'Thank-you cards, mailer stickers and labels before the big sale.', categoryId: 'labels', day: [11, 11], orderBy: [10, 20], leadDays: 45, tint: 'bg-magenta-200', emoji: '📦' },
  { id: '1212', name: '12.12 seller pack', taglish: '12.12 seller pack', blurb: 'Restock inserts, labels and packaging for the last big sale of the year.', categoryId: 'labels', day: [12, 12], orderBy: [11, 22], leadDays: 40, tint: 'bg-grape-200', emoji: '🛍️' },
  { id: 'valentines', name: "Valentine's specials", taglish: "Valentine's specials", blurb: 'Cake boxes, sleeves and gift tags for the sweetest week in food.', categoryId: 'bakery', day: [2, 14], orderBy: [1, 25], leadDays: 45, tint: 'bg-magenta-200', emoji: '💝' },
  { id: 'graduation', name: 'Graduation season', taglish: 'Graduation season', blurb: 'Invitations, tarps, programmes and giveaways.', categoryId: 'corporate', day: [6, 15], orderBy: [5, 20], leadDays: 45, tint: 'bg-sun-200', emoji: '🎓' },
  { id: 'newyear', name: 'New year, new look', taglish: 'New year, new look', blurb: 'Calendars, planners and refreshed packaging for January.', categoryId: 'marketing', day: [1, 1], orderBy: [12, 5], leadDays: 40, tint: 'bg-cyan-200', emoji: '✨' },
];

export type ActiveKit = SeasonKit & { daysLeft: number; orderByDate: Date };

/** Kits whose ordering window is open today, soonest deadline first. */
export function activeKits(today = new Date()): ActiveKit[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const out: ActiveKit[] = [];
  for (const kit of SEASON_KITS) {
    for (const year of [start.getFullYear(), start.getFullYear() + 1]) {
      const orderByDate = new Date(year, kit.orderBy[0] - 1, kit.orderBy[1]);
      const daysLeft = Math.round((orderByDate.getTime() - start.getTime()) / 86_400_000);
      if (daysLeft >= 0 && daysLeft <= kit.leadDays) {
        out.push({ ...kit, daysLeft, orderByDate });
        break;
      }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}
