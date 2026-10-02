'use client';

import {
  Constants,
  type DesiredColor,
  type ProfileImage as ProfileImageValue,
} from '@template/contracts';
import { type FocusEvent, useRef } from 'react';

import { ProfileImage } from './profile-image';
import { FieldError, FormField } from './ui/index';

interface ProfileAppearanceFieldsProps {
  profileImage: ProfileImageValue;
  desiredColor: DesiredColor;
  onProfileImageChange: (profileImage: ProfileImageValue) => void;
  onDesiredColorChange: (desiredColor: DesiredColor) => void;
  profileImageError?: string;
  desiredColorError?: string;
}

function closePickerOnBlur(event: FocusEvent<HTMLDetailsElement>) {
  if (
    !(event.relatedTarget instanceof Node) ||
    !event.currentTarget.contains(event.relatedTarget)
  ) {
    event.currentTarget.removeAttribute('open');
  }
}

export function ProfileAppearanceFields({
  profileImage,
  desiredColor,
  onProfileImageChange,
  onDesiredColorChange,
  profileImageError,
  desiredColorError,
}: ProfileAppearanceFieldsProps) {
  const profileImagePickerRef = useRef<HTMLDetailsElement>(null);
  const desiredColorPickerRef = useRef<HTMLDetailsElement>(null);

  return (
    <>
      <FormField>
        <details
          ref={profileImagePickerRef}
          className="appearancePicker profileImagePicker"
          onBlur={closePickerOnBlur}
        >
          <summary className="profileImagePickerTrigger" aria-label="Choose a carpet pattern">
            <ProfileImage image={profileImage} color={desiredColor} size={96} />
          </summary>
          <div
            className="appearancePickerGrid patternPickerGrid"
            role="group"
            aria-label="Carpet patterns"
          >
            {Constants.PROFILE_IMAGES.map((image) => (
              <button
                key={image}
                type="button"
                className="appearancePickerOption"
                aria-label={Constants.PROFILE_IMAGE_LABELS[image]}
                aria-pressed={image === profileImage}
                data-label={Constants.PROFILE_IMAGE_LABELS[image]}
                onClick={() => {
                  onProfileImageChange(image);
                  profileImagePickerRef.current?.removeAttribute('open');
                }}
              >
                <ProfileImage image={image} color={desiredColor} size={56} />
              </button>
            ))}
          </div>
        </details>
        <FieldError message={profileImageError} />
      </FormField>

      <FormField>
        <span id="desiredColorLabel" className="label">
          Color
        </span>
        <details
          ref={desiredColorPickerRef}
          className="appearancePicker"
          onBlur={closePickerOnBlur}
        >
          <summary
            id="desiredColorPicker"
            className="appearancePickerTrigger"
            aria-labelledby="desiredColorLabel desiredColorSelection"
          >
            <span
              className="colorSwatch"
              style={{ backgroundColor: Constants.DESIRED_COLOR_HEX[desiredColor] }}
            />
            <span id="desiredColorSelection">Choose a color</span>
          </summary>
          <div
            className="appearancePickerGrid colorPickerGrid"
            role="group"
            aria-labelledby="desiredColorLabel"
          >
            {Constants.DESIRED_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="appearancePickerOption"
                aria-label={color.charAt(0).toUpperCase() + color.slice(1)}
                aria-pressed={color === desiredColor}
                data-label={color.charAt(0).toUpperCase() + color.slice(1)}
                onClick={() => {
                  onDesiredColorChange(color);
                  desiredColorPickerRef.current?.removeAttribute('open');
                }}
              >
                <span
                  className="colorSwatch colorSwatchLarge"
                  style={{ backgroundColor: Constants.DESIRED_COLOR_HEX[color] }}
                />
              </button>
            ))}
          </div>
        </details>
        <FieldError message={desiredColorError} />
      </FormField>
    </>
  );
}
