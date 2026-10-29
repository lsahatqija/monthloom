import type { DesiredColor, Locale, ProfileImage, UserRole } from '@monthloom/contracts';

/** Backend-internal user entity. Includes the password hash; never exposed to transport layer. */
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  passwordHash: string;
  displayName: string;
  profileImage: ProfileImage;
  desiredColor: DesiredColor;
  locale: Locale;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  displayName: string;
  profileImage: ProfileImage;
  desiredColor: DesiredColor;
  locale: Locale;
  role?: UserRole;
}

export interface UpdateUserData {
  emailVerified?: boolean;
  passwordHash?: string;
  displayName?: string;
  profileImage?: ProfileImage;
  desiredColor?: DesiredColor;
  locale?: Locale;
}
