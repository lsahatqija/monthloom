import { Constants } from '@monthloom/contracts';
import {
  Building2,
  Caravan,
  Castle,
  Hotel,
  House,
  Houses,
  MountainSnow,
  Palmtree,
  School2,
  Ship,
  Tent,
  User,
  createLucideIcon,
  type LucideIcon,
} from 'lucide-react';

export type HouseholdIconName = (typeof Constants.HOUSEHOLD_ICONS)[number];

const LargeHouse = createLucideIcon('HouseholdLargeHouse', [
  ['path', { d: 'm2 11 7-7 7 7', key: 'main-roof' }],
  ['path', { d: 'M4 9v12h10V9', key: 'main-section' }],
  ['path', { d: 'M9 21v-6h3v6', key: 'door' }],
  ['path', { d: 'M14 8h4l4 5h-8', key: 'wing-roof' }],
  ['path', { d: 'M21 13v8h-7', key: 'wing' }],
  ['path', { d: 'M17 17h1', key: 'window' }],
]);

const Cottage = createLucideIcon('HouseholdCottage', [
  ['path', { d: 'm3 13 9-8 9 8', key: 'roof' }],
  ['path', { d: 'M5 11v10h14V11', key: 'walls' }],
  ['path', { d: 'M16 8.5V5h3v6', key: 'chimney' }],
  ['path', { d: 'M17.5 3c-1-1 1-1 0-2', key: 'smoke' }],
]);

const Barn = createLucideIcon('HouseholdBarn', [
  ['path', { d: 'M3 21V11l3-6 6-3 6 3 3 6v10Z', key: 'outline' }],
  ['path', { d: 'M8 21v-9h8v9M8 12l8 9M16 12l-8 9', key: 'barn-doors' }],
  ['path', { d: 'M11 7h2', key: 'loft-window' }],
]);

const Skyscraper = createLucideIcon('HouseholdSkyscraper', [
  ['path', { d: 'M6 21V7h12v14M9 7V4h6v3M12 4V1M3 21h18', key: 'tower' }],
  ['path', { d: 'M9 10h1m4 0h1M9 13h1m4 0h1M9 16h1m4 0h1', key: 'windows' }],
  ['path', { d: 'M11 21v-2h2v2', key: 'entrance' }],
]);

const HOUSEHOLD_ICON_COMPONENTS = {
  'small-house': User,
  'family-house': House,
  'large-house': LargeHouse,
  'beach-house': Palmtree,
  'mountain-cabin': MountainSnow,
  cottage: Cottage,
  farmhouse: Barn,
  townhouse: Houses,
  'short-apartments': Building2,
  'tall-apartments': Hotel,
  'office-building': Skyscraper,
  rv: Caravan,
  shack: Tent,
  villa: Castle,
  houseboat: Ship,
  'shared-house': School2,
} satisfies Record<HouseholdIconName, LucideIcon>;

const HOUSEHOLD_ICON_LABELS: Record<HouseholdIconName, string> = {
  'small-house': 'Personal',
  'family-house': 'House',
  'large-house': 'Mansion',
  'beach-house': 'Beach home',
  'mountain-cabin': 'Mountain cabin',
  cottage: 'Cottage',
  farmhouse: 'Farmhouse',
  townhouse: 'Townhouse',
  'short-apartments': 'Apartment',
  'tall-apartments': 'Apartment',
  'office-building': 'Office',
  rv: 'RV',
  shack: 'Shack',
  villa: 'Villa',
  houseboat: 'Houseboat',
  'shared-house': 'Shared home',
};

export function householdIconLabel(icon: HouseholdIconName): string {
  return HOUSEHOLD_ICON_LABELS[icon];
}

interface HouseholdIconProps {
  name: HouseholdIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function HouseholdIcon({ name, size = 20, strokeWidth = 2, className }: HouseholdIconProps) {
  const Icon = HOUSEHOLD_ICON_COMPONENTS[name];
  return <Icon aria-hidden={true} className={className} size={size} strokeWidth={strokeWidth} />;
}
