import basketWeave from '@assets/profile-images/basket-weave.png';
import braidedBorder from '@assets/profile-images/braided-border.png';
import chevronWeave from '@assets/profile-images/chevron-weave.png';
import concentricLozenge from '@assets/profile-images/concentric-lozenge.png';
import diamondKilim from '@assets/profile-images/diamond-kilim.png';
import hookedDiamond from '@assets/profile-images/hooked-diamond.png';
import hourglassThread from '@assets/profile-images/hourglass-thread.png';
import latticeLoom from '@assets/profile-images/lattice-loom.png';
import mosaicGrid from '@assets/profile-images/mosaic-grid.png';
import starRosette from '@assets/profile-images/star-rosette.png';
import steppedMedallion from '@assets/profile-images/stepped-medallion.png';
import waveStripe from '@assets/profile-images/wave-stripe.png';
import { Constants, type DesiredColor, type ProfileImage } from '@template/contracts';
import type { CSSProperties } from 'react';

const PROFILE_IMAGE_ASSETS = {
  'diamond-kilim': diamondKilim,
  'chevron-weave': chevronWeave,
  'lattice-loom': latticeLoom,
  'stepped-medallion': steppedMedallion,
  'hooked-diamond': hookedDiamond,
  'basket-weave': basketWeave,
  'wave-stripe': waveStripe,
  'star-rosette': starRosette,
  'hourglass-thread': hourglassThread,
  'mosaic-grid': mosaicGrid,
  'braided-border': braidedBorder,
  'concentric-lozenge': concentricLozenge,
} as const satisfies Record<ProfileImage, { src: string }>;

interface ProfileImageProps {
  image: ProfileImage;
  color: DesiredColor;
  size?: number;
}

export function ProfileImage({ image, color, size = 80 }: ProfileImageProps) {
  const maskImage = `url("${PROFILE_IMAGE_ASSETS[image].src}")`;
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: Constants.DESIRED_COLOR_HEX[color],
    maskImage,
    WebkitMaskImage: maskImage,
  };

  return (
    <span
      className="profileImage"
      style={style}
      role="img"
      aria-label={`${Constants.PROFILE_IMAGE_LABELS[image]} profile image in ${color}`}
    />
  );
}
