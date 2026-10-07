import { Constants } from '@template/contracts';
import {
  Building2,
  BuildingComplex,
  Caravan,
  Castle,
  Hotel,
  HouseHeart,
  HousePlus,
  HouseWifi,
  Houses,
  MapPinHouse,
  MountainSnow,
  Palmtree,
  School2,
  Ship,
  Tent,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export type HouseholdIconName = (typeof Constants.HOUSEHOLD_ICONS)[number];

const HOUSEHOLD_ICON_COMPONENTS = {
  'small-house': MapPinHouse,
  'family-house': HouseHeart,
  'large-house': HousePlus,
  'beach-house': Palmtree,
  'mountain-cabin': MountainSnow,
  cottage: HouseWifi,
  farmhouse: Warehouse,
  townhouse: Houses,
  'short-apartments': Building2,
  'tall-apartments': Hotel,
  'office-building': BuildingComplex,
  rv: Caravan,
  shack: Tent,
  villa: Castle,
  houseboat: Ship,
  'shared-house': School2,
} satisfies Record<HouseholdIconName, LucideIcon>;

const HOUSEHOLD_ICON_LABELS: Record<HouseholdIconName, string> = {
  'small-house': 'Small house',
  'family-house': 'Medium house',
  'large-house': 'Big house',
  'beach-house': 'Beach home',
  'mountain-cabin': 'Mountain cabin',
  cottage: 'Cottage',
  farmhouse: 'Farmhouse',
  townhouse: 'Townhouse',
  'short-apartments': 'Short apartment building',
  'tall-apartments': 'Tall apartment building',
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
