/**
 * Product defaults that may occasionally change between releases or for events.
 *
 * Keep these separate from validation limits and supported-value lists so every
 * application layer can use the same initial configuration.
 */
export class Defaults {
  static readonly THEME = 'linen-sage' as const;
  static readonly COLOR_MODE = 'light' as const;
  static readonly DARK_HEADER_IN_LIGHT_MODE = false;

  static readonly USER_PROFILE_IMAGE = 'diamond-kilim' as const;
  static readonly USER_DESIRED_COLOR = 'indigo' as const;

  static readonly HOUSEHOLD_CURRENCY = 'EUR' as const;
  static readonly HOUSEHOLD_ICON = 'small-house' as const;
  static readonly HOUSEHOLD_COLOR = '#35675B' as const;

  static readonly TRANSACTION_KIND = 'expense' as const;
  static readonly TRANSACTION_TYPE = 'other' as const;
  static readonly INCOME_TRANSACTION_TYPE = 'income' as const;
  static readonly TRANSACTION_ICON = 'receipt' as const;
  static readonly INCOME_TRANSACTION_ICON = 'banknote' as const;
  static readonly TRANSACTION_COLOR = '#35675B' as const;
  static readonly TRANSACTION_RECURRING = false;
  static readonly TRANSACTION_RECURRENCE_INTERVAL = 1;
  static readonly TRANSACTION_RECURRENCE_UNIT = 'month' as const;
  static readonly TRANSACTION_SORT_KEY = 'date' as const;
  static readonly TRANSACTION_SORT_DIRECTION = 'descending' as const;
}
