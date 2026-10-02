import {
  Constants,
  type DesiredColor,
  type ProfileImage as ProfileImageValue,
} from '@template/contracts';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { ProfileImage } from './profile-image';
import { FieldError, FormField, Label } from './ui/index';

interface ProfileAppearanceFieldsProps {
  profileImage: ProfileImageValue;
  desiredColor: DesiredColor;
  profileImageRegistration: UseFormRegisterReturn<'profileImage'>;
  desiredColorRegistration: UseFormRegisterReturn<'desiredColor'>;
  profileImageError?: string;
  desiredColorError?: string;
}

export function ProfileAppearanceFields({
  profileImage,
  desiredColor,
  profileImageRegistration,
  desiredColorRegistration,
  profileImageError,
  desiredColorError,
}: ProfileAppearanceFieldsProps) {
  return (
    <>
      <div className="profileAppearancePreview">
        <ProfileImage image={profileImage} color={desiredColor} />
      </div>

      <FormField>
        <Label htmlFor="profileImage">Carpet pattern</Label>
        <select id="profileImage" className="input" {...profileImageRegistration}>
          {Constants.PROFILE_IMAGES.map((image) => (
            <option key={image} value={image}>
              {Constants.PROFILE_IMAGE_LABELS[image]}
            </option>
          ))}
        </select>
        <FieldError message={profileImageError} />
      </FormField>

      <FormField>
        <Label htmlFor="desiredColor">Color</Label>
        <select id="desiredColor" className="input" {...desiredColorRegistration}>
          {Constants.DESIRED_COLORS.map((color) => (
            <option key={color} value={color}>
              {color.charAt(0).toUpperCase() + color.slice(1)}
            </option>
          ))}
        </select>
        <FieldError message={desiredColorError} />
      </FormField>
    </>
  );
}
