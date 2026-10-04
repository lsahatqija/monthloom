import { Constants } from '@template/contracts';
import {
  Apple,
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Building,
  Bus,
  Car,
  CircleEllipsis,
  Coffee,
  Coins,
  CreditCard,
  Droplet,
  Dumbbell,
  Film,
  Fuel,
  Gamepad,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Music,
  PawPrint,
  PiggyBank,
  Pizza,
  Plane,
  Plug,
  Receipt,
  Scissors,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Store,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type FinancialIconName = (typeof Constants.FINANCIAL_ICONS)[number];

const FINANCIAL_ICON_COMPONENTS = {
  banknote: Banknote,
  briefcase: Briefcase,
  building: Building,
  coins: Coins,
  landmark: Landmark,
  'piggy-bank': PiggyBank,
  'trending-up': TrendingUp,
  wallet: Wallet,
  gift: Gift,
  house: House,
  store: Store,
  'shopping-cart': ShoppingCart,
  'shopping-basket': ShoppingBasket,
  'shopping-bag': ShoppingBag,
  apple: Apple,
  utensils: Utensils,
  coffee: Coffee,
  pizza: Pizza,
  car: Car,
  bus: Bus,
  fuel: Fuel,
  plane: Plane,
  plug: Plug,
  droplet: Droplet,
  wifi: Wifi,
  smartphone: Smartphone,
  'heart-pulse': HeartPulse,
  shield: Shield,
  'graduation-cap': GraduationCap,
  'book-open': BookOpen,
  gamepad: Gamepad,
  music: Music,
  film: Film,
  shirt: Shirt,
  dumbbell: Dumbbell,
  baby: Baby,
  'paw-print': PawPrint,
  scissors: Scissors,
  wrench: Wrench,
  receipt: Receipt,
  'credit-card': CreditCard,
  'circle-ellipsis': CircleEllipsis,
} satisfies Record<FinancialIconName, LucideIcon>;

export function financialIconLabel(icon: FinancialIconName): string {
  return icon.replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

interface FinancialIconProps {
  name: FinancialIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function FinancialIcon({ name, size = 20, strokeWidth = 2, className }: FinancialIconProps) {
  const Icon = FINANCIAL_ICON_COMPONENTS[name];
  return <Icon aria-hidden={true} className={className} size={size} strokeWidth={strokeWidth} />;
}
