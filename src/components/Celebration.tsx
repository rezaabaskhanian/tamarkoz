import LottieView from 'lottie-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, type StyleProp, type ViewStyle } from 'react-native';
import { LOTTIE_SOURCES, type CelebrationKind } from '../assets/lottie';

/**
 * Plays one of the bundled Lottie animations. With «reduce motion» on, it shows
 * the last frame instead of playing.
 */
export function Celebration({
  kind,
  size,
  loop = false,
  style,
}: {
  kind: CelebrationKind;
  size?: number;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [still, setStill] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);
  return (
    <LottieView
      source={LOTTIE_SOURCES[kind]}
      autoPlay={!still}
      loop={loop && !still}
      progress={still ? 1 : undefined}
      resizeMode="contain"
      style={[size ? { width: size, height: size } : null, style]}
    />
  );
}
