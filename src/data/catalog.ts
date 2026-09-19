import type { LucideIcon } from 'lucide-react';
import {
  Box,
  Croissant,
  Coffee,
  CakeSlice,
  Sparkles,
  ShoppingBag,
  Megaphone,
  Sticker,
  Building2,
  ScanLine,
  ListChecks,
  Package,
  CupSoda,
  Cookie,
  ShoppingBasket,
  Tag,
  FileText,
  Calendar,
  Store,
  Stamp,
  Newspaper,
  Gift,
} from 'lucide-react';

export type QuantOption = {
  value: string;
  label: string;
  hint: string;
};

export type PackagingType = {
  id: string;
  name: string;
  description: string;
  blurb: string;
  recommendedFor: string[];
};

export type CatalogItem = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  image?: string;
  packagingOptions?: string[];
};

export type CatalogCategory = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  image: string;
  recommendations: CatalogItem[];
  isSpecial?: boolean;
  specialFlow?: 'sample' | 'expert';
};

export const QUANTITY_OPTIONS: QuantOption[] = [
  { value: 'small', label: '100–500', hint: 'Perfect for starting out or a first batch' },
  { value: 'medium', label: '500–2,000', hint: 'Great for growing brands and regular stock' },
  { value: 'large', label: '2,000–10,000', hint: 'Best value for established businesses' },
  { value: 'bulk', label: '10,000+', hint: 'High-volume production pricing' },
];

export const TIMELINE_OPTIONS: QuantOption[] = [
  { value: 'rush', label: 'ASAP / Rush', hint: 'We fast-track production where possible' },
  { value: 'standard', label: '2–3 weeks', hint: 'Our most common and cost-effective timeline' },
  { value: 'flexible', label: 'Flexible', hint: 'Best pricing — we optimize production scheduling' },
  { value: 'planning', label: 'Just exploring', hint: 'No pressure — get a plan ready' },
];

export const PACKAGING_TYPES: PackagingType[] = [
  {
    id: 'kraft',
    name: 'Kraft / Natural Board',
    description: 'Earth-toned unbleached board with a warm, artisanal feel.',
    blurb: 'A favorite for bakeries, cafés, and eco-conscious brands. Pairs beautifully with one-color prints.',
    recommendedFor: ['food', 'coffee', 'bakery', 'retail'],
  },
  {
    id: 'art-card',
    name: 'Art Card / Coated Board',
    description: 'Smooth, bright surface for crisp, vivid full-color printing.',
    blurb: 'The go-to for premium product packaging and cosmetics where color accuracy matters.',
    recommendedFor: ['product', 'beauty', 'retail', 'labels'],
  },
  {
    id: 'corrugated',
    name: 'Corrugated Carton',
    description: 'Structured, protective board for shipping and bulk packaging.',
    blurb: 'Best when your product needs to survive transport — shipping boxes, e-commerce, bulk food.',
    recommendedFor: ['product', 'food', 'retail'],
  },
  {
    id: 'sticker-paper',
    name: 'Paper Labels & Stickers',
    description: 'Versatile adhesive labels in any shape or finish.',
    blurb: 'Fast to produce, perfect for labeling products, jars, bags, and packaging seals.',
    recommendedFor: ['labels', 'coffee', 'beauty', 'food', 'bakery'],
  },
  {
    id: 'sticker-vinyl',
    name: 'Vinyl Stickers & Decals',
    description: 'Durable, water-resistant stickers for surfaces and signage.',
    blurb: 'Waterproof and weather-resistant — ideal for storefronts, products, and outdoor use.',
    recommendedFor: ['labels', 'retail', 'corporate', 'marketing'],
  },
  {
    id: 'textured',
    name: 'Textured / Specialty Paper',
    description: 'Linen, felt, or laid finishes for a tactile premium impression.',
    blurb: 'Elevates business cards, invitations, and corporate materials with a handcrafted feel.',
    recommendedFor: ['corporate', 'marketing', 'retail'],
  },
];

export const CATEGORIES: CatalogCategory[] = [
  {
    id: 'product',
    name: 'Product Packaging',
    tagline: 'Boxes and cartons that make your product stand out on the shelf.',
    description: 'Custom-printed boxes, cartons, and inserts that turn a product into a brand.',
    icon: Box,
    image:
      'https://images.pexels.com/photos/9594420/pexels-photo-9594420.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    recommendations: [
      { id: 'product-box', name: 'Product Boxes', description: 'Custom-folded boxes tailored to your product', icon: Package, packagingOptions: ['art-card', 'corrugated', 'kraft'] },
      { id: 'product-insert', name: 'Box Inserts', description: 'Protective inserts that hold items in place', icon: Box, packagingOptions: ['corrugated', 'art-card'] },
      { id: 'product-sleeve', name: 'Box Sleeves', description: 'Printed sleeves that slide over plain boxes', icon: Sticker, packagingOptions: ['art-card', 'kraft'] },
      { id: 'product-mailer', name: 'Mailer Boxes', description: 'E-commerce-ready shipping boxes with style', icon: Package, packagingOptions: ['corrugated', 'kraft'] },
    ],
  },
  {
    id: 'food',
    name: 'Food Packaging',
    tagline: 'Safe, food-grade packaging for takeout and ready-to-eat.',
    description: 'Food-safe containers, trays, and wraps that keep food fresh and look great.',
    icon: CupSoda,
    image:
      'https://images.pexels.com/photos/15807279/pexels-photo-15807279.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    recommendations: [
      { id: 'food-box', name: 'Takeout Boxes', description: 'Folding food boxes for meals and snacks', icon: Package, packagingOptions: ['kraft', 'art-card'] },
      { id: 'food-tray', name: 'Food Trays', description: 'Trays for pastries, burgers, and finger food', icon: ShoppingBasket, packagingOptions: ['kraft'] },
      { id: 'food-wrap', name: 'Food Wraps & Bags', description: 'Grease-proof wraps and paper bags', icon: ShoppingBag, packagingOptions: ['kraft'] },
      { id: 'food-cup', name: 'Food Cups & Tubs', description: 'Cups for soups, salads, and desserts', icon: CupSoda, packagingOptions: ['kraft', 'art-card'] },
    ],
  },
  {
    id: 'coffee',
    name: 'Coffee Shop',
    tagline: 'Cups, sleeves, pastry boxes, menus, labels, bags, and signage.',
    description: 'Everything a coffee shop needs to look cohesive and professional.',
    icon: Coffee,
    image:
      'https://images.pexels.com/photos/13789905/pexels-photo-13789905.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    recommendations: [
      { id: 'coffee-cup', name: 'Cup Sleeves', description: 'Branded cup sleeves that protect hands', icon: Coffee, packagingOptions: ['kraft', 'art-card'] },
      { id: 'coffee-pastry', name: 'Pastry Boxes', description: 'Windowed boxes for pastries and cakes', icon: Croissant, packagingOptions: ['kraft', 'art-card'] },
      { id: 'coffee-bag', name: 'Takeaway Bags', description: 'Paper bags with your logo and message', icon: ShoppingBag, packagingOptions: ['kraft'] },
      { id: 'coffee-label', name: 'Product Labels', description: 'Labels for cups, bottles, and packaging', icon: Tag, packagingOptions: ['sticker-paper', 'sticker-vinyl'] },
      { id: 'coffee-menu', name: 'Menus & Signage', description: 'Printed menus, table tents, and decals', icon: FileText, packagingOptions: ['art-card', 'sticker-vinyl'] },
      { id: 'coffee-loyalty', name: 'Loyalty Cards', description: 'Punch cards that keep customers coming back', icon: Stamp, packagingOptions: ['art-card', 'textured'] },
    ],
  },
  {
    id: 'bakery',
    name: 'Bakery or Cake Business',
    tagline: 'Cake boxes, pastry trays, labels, bags, and gift packaging.',
    description: 'Beautiful packaging that protects your baked goods and showcases your craft.',
    icon: CakeSlice,
    image:
      'https://images.pexels.com/photos/15063294/pexels-photo-15063294.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    recommendations: [
      { id: 'bakery-cake-box', name: 'Cake Boxes', description: 'Windowed cake boxes in any size', icon: CakeSlice, packagingOptions: ['kraft', 'art-card'] },
      { id: 'bakery-pastry', name: 'Pastry Trays', description: 'Trays and boxes for individual pastries', icon: Cookie, packagingOptions: ['kraft', 'art-card'] },
      { id: 'bakery-label', name: 'Bakery Labels', description: 'Ingredient labels, allergy tags, and seals', icon: Tag, packagingOptions: ['sticker-paper'] },
      { id: 'bakery-bag', name: 'Bakery Bags', description: 'Windowed paper bags for bread and treats', icon: ShoppingBag, packagingOptions: ['kraft'] },
      { id: 'bakery-gift', name: 'Gift Packaging', description: 'Ribbon-ready gift boxes for special orders', icon: Gift, packagingOptions: ['art-card', 'textured'] },
    ],
  },
  {
    id: 'beauty',
    name: 'Beauty and Skincare',
    tagline: 'Premium boxes, labels, and sleeves for cosmetics and skincare.',
    description: 'Luxury-level packaging that makes beauty products feel worth it.',
    icon: Sparkles,
    image:
      'https://images.pexels.com/photos/4841343/pexels-photo-4841343.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    recommendations: [
      { id: 'beauty-box', name: 'Product Boxes', description: 'Folding cartons for bottles, jars, and tubes', icon: Package, packagingOptions: ['art-card', 'textured'] },
      { id: 'beauty-label', name: 'Product Labels', description: 'Waterproof labels for bottles and tubes', icon: Tag, packagingOptions: ['sticker-vinyl', 'sticker-paper'] },
      { id: 'beauty-sleeve', name: 'Box Sleeves', description: 'Printed sleeves for a premium unboxing feel', icon: Sticker, packagingOptions: ['art-card', 'textured'] },
      { id: 'beauty-insert', name: 'Box Inserts', description: 'Custom inserts that hold products securely', icon: Box, packagingOptions: ['art-card'] },
      { id: 'beauty-seal', name: 'Tamper Seals', description: 'Security seals that build trust', icon: Stamp, packagingOptions: ['sticker-paper'] },
    ],
  },
  {
    id: 'retail',
    name: 'Retail',
    tagline: 'Shopping bags, hang tags, signage, and shelf-ready packaging.',
    description: 'Retail packaging and materials that pull customers in and build brand recall.',
    icon: ShoppingBag,
    image:
      'https://images.pexels.com/photos/7319110/pexels-photo-7319110.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    recommendations: [
      { id: 'retail-bag', name: 'Shopping Bags', description: 'Custom paper bags with rope or flat handles', icon: ShoppingBag, packagingOptions: ['kraft', 'art-card'] },
      { id: 'retail-tag', name: 'Hang Tags', description: 'Product hang tags with string and barcode', icon: Tag, packagingOptions: ['art-card', 'textured'] },
      { id: 'retail-signage', name: 'Shelf & Window Signage', description: 'Point-of-sale signs and window decals', icon: Store, packagingOptions: ['art-card', 'sticker-vinyl'] },
      { id: 'retail-display', name: 'Shelf-Ready Packaging', description: 'Display-ready boxes for retail shelves', icon: Package, packagingOptions: ['corrugated', 'art-card'] },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing Materials',
    tagline: 'Flyers, brochures, posters, and standees that get attention.',
    description: 'High-impact printed marketing that moves people to act.',
    icon: Megaphone,
    image:
      'https://images.pexels.com/photos/860227/pexels-photo-860227.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    recommendations: [
      { id: 'marketing-flyer', name: 'Flyers & Leaflets', description: 'Single-page promotions in any size', icon: FileText, packagingOptions: ['art-card'] },
      { id: 'marketing-brochure', name: 'Brochures', description: 'Folded multi-panel brochures', icon: Newspaper, packagingOptions: ['art-card', 'textured'] },
      { id: 'marketing-poster', name: 'Posters', description: 'Large-format posters for walls and windows', icon: Megaphone, packagingOptions: ['art-card'] },
      { id: 'marketing-standee', name: 'Standees & Banners', description: 'Floor standees and pull-up banners', icon: Store, packagingOptions: ['art-card'] },
    ],
  },
  {
    id: 'labels',
    name: 'Labels and Stickers',
    tagline: 'Die-cut stickers, roll labels, and product labels in any shape.',
    description: 'Custom-cut stickers and labels for products, packaging, and promotions.',
    icon: Sticker,
    image:
      'https://images.pexels.com/photos/38581652/pexels-photo-38581652.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    recommendations: [
      { id: 'labels-roll', name: 'Roll Labels', description: 'High-volume labels on a roll for machine application', icon: Tag, packagingOptions: ['sticker-paper', 'sticker-vinyl'] },
      { id: 'labels-diecut', name: 'Die-Cut Stickers', description: 'Custom-shaped stickers in any design', icon: Sticker, packagingOptions: ['sticker-paper', 'sticker-vinyl'] },
      { id: 'labels-sheet', name: 'Sheet Stickers', description: 'Multiple stickers on a single sheet', icon: Sticker, packagingOptions: ['sticker-paper'] },
      { id: 'labels-seal', name: 'Seal Stickers', description: 'Circular seals for packaging and envelopes', icon: Stamp, packagingOptions: ['sticker-paper'] },
    ],
  },
  {
    id: 'corporate',
    name: 'Corporate and Events',
    tagline: 'Business cards, invitations, event kits, and conference materials.',
    description: 'Polished printed materials for companies, conferences, and special events.',
    icon: Building2,
    image:
      'https://images.pexels.com/photos/35138560/pexels-photo-35138560.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    recommendations: [
      { id: 'corporate-cards', name: 'Business Cards', description: 'Premium cards with finishing options', icon: FileText, packagingOptions: ['art-card', 'textured'] },
      { id: 'corporate-invite', name: 'Invitations', description: 'Event and wedding invitations with envelopes', icon: Gift, packagingOptions: ['textured', 'art-card'] },
      { id: 'corporate-kit', name: 'Event Kits', description: 'Folders, ID cards, and attendee materials', icon: Calendar, packagingOptions: ['art-card'] },
      { id: 'corporate-booth', name: 'Booth & Signage', description: 'Trade show backdrops and booth materials', icon: Store, packagingOptions: ['art-card', 'sticker-vinyl'] },
    ],
  },
  {
    id: 'sample',
    name: 'Bring Your Own Sample',
    tagline: 'Have a sample or reference? We will reverse-engineer and improve it.',
    description: 'Show us something you already have, and we will match or upgrade it.',
    icon: ScanLine,
    image:
      'https://images.pexels.com/photos/9594430/pexels-photo-9594430.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    isSpecial: true,
    specialFlow: 'sample',
    recommendations: [],
  },
  {
    id: 'expert',
    name: 'I Already Know What I Need',
    tagline: 'Skip the guidance and go straight to a precise request.',
    description: 'For experienced buyers who know their specs — tell us the details.',
    icon: ListChecks,
    image:
      'https://images.pexels.com/photos/9878733/pexels-photo-9878733.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    isSpecial: true,
    specialFlow: 'expert',
    recommendations: [],
  },
];

export const INSPIRATION_ITEMS: {
  title: string;
  category: string;
  location: string;
  image: string;
  span?: 'tall' | 'wide' | 'normal';
  items: string[];
  result: string;
}[] = [
  {
    title: 'Café Brand Transformation',
    category: 'Coffee Shop',
    location: 'Independent café, Batangas',
    image: 'https://images.pexels.com/photos/34010581/pexels-photo-34010581.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    span: 'tall',
    items: ['Cup sleeves', 'Pastry boxes', 'Window decals'],
    result: 'Customers started recognizing the brand from across the street.',
  },
  {
    title: 'Skincare Launch Kit',
    category: 'Beauty and Skincare',
    location: 'Online beauty brand, Makati',
    image: 'https://images.pexels.com/photos/8015461/pexels-photo-8015461.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    span: 'wide',
    items: ['Folding cartons', 'Waterproof labels', 'Box sleeves'],
    result: 'Unboxing photos went viral — first sellout in 3 weeks.',
  },
  {
    title: 'Bakery Window Boxes',
    category: 'Bakery',
    location: 'Home bakery, Pasig',
    image: 'https://images.pexels.com/photos/32422492/pexels-photo-32422492.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    span: 'normal',
    items: ['Cake boxes', 'Ingredient labels', 'Gift bags'],
    result: 'Wholesale orders tripled after the rebrand.',
  },
  {
    title: 'Retail Bag Redesign',
    category: 'Retail',
    location: 'Boutique, Cebu City',
    image: 'https://images.pexels.com/photos/7987587/pexels-photo-7987587.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    span: 'normal',
    items: ['Shopping bags', 'Hang tags', 'Shelf signage'],
    result: 'Bags became walking ads — foot traffic up 40%.',
  },
  {
    title: 'Premium Product Launch',
    category: 'Product Packaging',
    location: 'Startup, Taguig',
    image: 'https://images.pexels.com/photos/31651848/pexels-photo-31651848.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    span: 'wide',
    items: ['Rigid boxes', 'Magnetic closures', 'Foil stamps'],
    result: 'Investors said the packaging sold the product before the pitch.',
  },
  {
    title: 'Craft Label System',
    category: 'Labels and Stickers',
    location: 'Hot sauce maker, Davao',
    image: 'https://images.pexels.com/photos/7563593/pexels-photo-7563593.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    span: 'normal',
    items: ['Roll labels', 'Tamper seals', 'Batch stickers'],
    result: 'Shelf presence doubled — picked up by two supermarket chains.',
  },
];

/**
 * Design specialties a designer can be matched on.
 *
 * Mirrors the design_specialties table, the same way CATEGORIES mirrors
 * print_categories — the database stays the source of truth for matching, this
 * is the copy the signup form renders without a round trip. Keep the ids in
 * step with 20260810000200_designer_marketplace_schema.sql.
 *
 * Deliberately narrow: print-adjacent design that feeds a print job, not
 * general freelance design. Adding a category here that does not end in
 * something printed is a change of product, not a change of copy.
 */
export const DESIGN_SPECIALTIES: { id: string; name: string; tagline: string }[] = [
  { id: 'logo', name: 'Logo Design', tagline: 'A mark and wordmark your printed materials can build around.' },
  { id: 'label', name: 'Label Design', tagline: 'Product and packaging labels, sized and bled for print.' },
  { id: 'packaging', name: 'Packaging & Box', tagline: 'Dieline-aware box, carton, and pouch design.' },
  { id: 'product-graphics', name: 'Product Graphics', tagline: 'Print-ready graphics for an existing product line.' },
];

/**
 * How a catalog item's size is expressed.
 *
 * Printers quote three-dimensional and flat work differently, so a single
 * free-text "size" box makes customers guess at a format and leaves partners
 * reading "5x" with no idea what was meant. Each shape maps to a labelled set
 * of inputs in the project builder.
 *
 *   box  — folded cartons, trays, tubs: Length x Width x Height
 *   bag  — bags, wraps, pouches: Width x Height x Gusset (the trade's own
 *          convention; a bag has no meaningful "length")
 *   flat — anything printed on a single plane: Width x Height
 *
 * Items deliberately absent (event kits, booth builds) are genuinely bespoke
 * and keep the free-text field rather than being forced into a shape that
 * would misdescribe them.
 */
export type DimensionShape = 'box' | 'bag' | 'flat';

const DIMENSION_SHAPES: Record<string, DimensionShape> = {
  // Three-dimensional: cartons, trays, tubs, and the sleeves that wrap them
  // (a sleeve is specified by the box or cup it has to fit).
  'product-box': 'box',
  'product-insert': 'box',
  'product-mailer': 'box',
  'product-sleeve': 'box',
  'food-box': 'box',
  'food-tray': 'box',
  'food-cup': 'box',
  'coffee-cup': 'box',
  'coffee-pastry': 'box',
  'bakery-cake-box': 'box',
  'bakery-pastry': 'box',
  'beauty-box': 'box',
  'beauty-insert': 'box',
  'beauty-sleeve': 'box',
  'retail-display': 'box',

  // Bags, wraps and pouches.
  'food-wrap': 'bag',
  'coffee-bag': 'bag',
  'bakery-bag': 'bag',
  'retail-bag': 'bag',

  // Flat printed work: labels, stickers, signage, marketing collateral.
  'coffee-label': 'flat',
  'coffee-menu': 'flat',
  'coffee-loyalty': 'flat',
  'bakery-label': 'flat',
  'beauty-label': 'flat',
  'beauty-seal': 'flat',
  'retail-tag': 'flat',
  'retail-signage': 'flat',
  'marketing-flyer': 'flat',
  'marketing-brochure': 'flat',
  'marketing-poster': 'flat',
  'marketing-standee': 'flat',
  'labels-roll': 'flat',
  'labels-diecut': 'flat',
  'labels-sheet': 'flat',
  'labels-seal': 'flat',
  'corporate-cards': 'flat',
  'corporate-invite': 'flat',
};

/** Axis labels per shape, in the order they are entered and stored. */
export const DIMENSION_AXES: Record<DimensionShape, string[]> = {
  box: ['Length', 'Width', 'Height'],
  bag: ['Width', 'Height', 'Gusset'],
  flat: ['Width', 'Height'],
};

export const DIMENSION_UNITS = ['in', 'cm', 'mm'] as const;
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

/** Returns null for bespoke items, which keep the free-text size field. */
export function dimensionShapeFor(itemId: string | null | undefined): DimensionShape | null {
  if (!itemId) return null;
  return DIMENSION_SHAPES[itemId] ?? null;
}

export const PROVIDER_CAPABILITIES = [
  'Offset Printing',
  'Digital Printing',
  'Large Format',
  'Folding Cartons',
  'Corrugated Boxes',
  'Labels & Stickers',
  'Flexible Packaging',
  'Specialty Finishing',
  'Screen Printing',
  'Book Printing',
];
