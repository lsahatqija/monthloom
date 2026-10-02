/** Shared values used by validation, persistence, and user-interface controls. */
export class Constants {
  static readonly DISPLAY_NAME_MIN_LENGTH = 1;
  static readonly DISPLAY_NAME_MAX_LENGTH = 120;
  static readonly EMAIL_MAX_LENGTH = 320;
  static readonly PASSWORD_MIN_LENGTH = 8;
  static readonly PASSWORD_MAX_LENGTH = 200;

  static readonly USER_ROLES = ['user', 'admin'] as const;

  static readonly PROFILE_IMAGES = [
    'diamond-kilim',
    'chevron-weave',
    'lattice-loom',
    'stepped-medallion',
    'hooked-diamond',
    'basket-weave',
    'wave-stripe',
    'star-rosette',
    'hourglass-thread',
    'mosaic-grid',
    'braided-border',
    'concentric-lozenge',
  ] as const;
  static readonly PROFILE_IMAGE_LABELS = {
    'diamond-kilim': 'Diamond Kilim',
    'chevron-weave': 'Chevron Weave',
    'lattice-loom': 'Lattice Loom',
    'stepped-medallion': 'Stepped Medallion',
    'hooked-diamond': 'Hooked Diamond',
    'basket-weave': 'Basket Weave',
    'wave-stripe': 'Wave Stripe',
    'star-rosette': 'Star Rosette',
    'hourglass-thread': 'Hourglass Thread',
    'mosaic-grid': 'Mosaic Grid',
    'braided-border': 'Braided Border',
    'concentric-lozenge': 'Concentric Lozenge',
  } as const;
  static readonly DEFAULT_PROFILE_IMAGE = 'diamond-kilim' as const;

  static readonly DESIRED_COLORS = [
    'slate',
    'red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'emerald',
    'teal',
    'cyan',
    'sky',
    'blue',
    'indigo',
    'violet',
    'purple',
    'rose',
  ] as const;
  static readonly DESIRED_COLOR_HEX = {
    slate: '#475569',
    red: '#dc2626',
    orange: '#ea580c',
    amber: '#d97706',
    yellow: '#f0af23',
    lime: '#65a30d',
    green: '#048d36',
    emerald: '#027c55',
    teal: '#0d9488',
    cyan: '#1ca7ca',
    sky: '#0284c7',
    blue: '#1252da',
    indigo: '#4f46e5',
    violet: '#7c3aed',
    purple: '#bf33ea',
    rose: '#f34d71',
  } as const;
  static readonly DEFAULT_DESIRED_COLOR = 'indigo' as const;

  /** Stable icon keys used by income and expense entries. */
  static readonly FINANCIAL_ICONS = [
    'banknote',
    'briefcase',
    'building',
    'coins',
    'landmark',
    'piggy-bank',
    'trending-up',
    'wallet',
    'gift',
    'house',
    'store',
    'shopping-cart',
    'shopping-basket',
    'shopping-bag',
    'apple',
    'utensils',
    'coffee',
    'pizza',
    'car',
    'bus',
    'fuel',
    'plane',
    'plug',
    'droplet',
    'wifi',
    'smartphone',
    'heart-pulse',
    'shield',
    'graduation-cap',
    'book-open',
    'gamepad',
    'music',
    'film',
    'shirt',
    'dumbbell',
    'baby',
    'paw-print',
    'scissors',
    'wrench',
    'receipt',
    'credit-card',
    'circle-ellipsis',
  ] as const;

  /** Categories used to group and filter expenses independently of their icon. */
  static readonly EXPENSE_TYPES = [
    'housing',
    'groceries',
    'dining',
    'transport',
    'utilities',
    'healthcare',
    'insurance',
    'childcare',
    'education',
    'entertainment',
    'shopping',
    'travel',
    'subscriptions',
    'taxes',
    'debt',
    'savings',
    'gifts',
    'pets',
    'personal-care',
    'other',
  ] as const;
}
