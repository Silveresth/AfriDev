import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Polyline } from 'react-native-svg';

/** Vert du point central (logo officiel). */
export const BRAND_GREEN = '#3DDC84';
export const BRAND_TERRACOTTA = '#C84B20';

const STROKE = 92;
const LEFT = '412,334 262,512 412,690';
const RIGHT = '612,334 762,512 612,690';

function Layer({ size, children, style }: { size: number; children: React.ReactNode; style?: AnimatedStyle<ViewStyle> }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        {children}
      </Svg>
    </Animated.View>
  );
}

/**
 * Logo AfriDev en trois calques (chevron gauche, chevron droit, point) : chacun peut être animé
 * séparément. Repère 1024 identique à src/assets/splash-logo.png (splash natif).
 */
export function BrandMark({
  size,
  color = '#FFFFFF',
  dotColor = BRAND_GREEN,
  leftStyle,
  rightStyle,
  dotStyle,
}: {
  size: number;
  color?: string;
  dotColor?: string;
  leftStyle?: AnimatedStyle<ViewStyle>;
  rightStyle?: AnimatedStyle<ViewStyle>;
  dotStyle?: AnimatedStyle<ViewStyle>;
}) {
  return (
    <View style={{ width: size, height: size }}>
      <Layer size={size} style={leftStyle}>
        <Polyline points={LEFT} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
      </Layer>
      <Layer size={size} style={rightStyle}>
        <Polyline points={RIGHT} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
      </Layer>
      <Layer size={size} style={dotStyle}>
        <Circle cx={512} cy={512} r={56} fill={dotColor} />
      </Layer>
    </View>
  );
}

/** Pavé de l'icône (carré arrondi terre cuite) avec la marque, pour l'écran de connexion. */
export function BrandTile({ size = 56 }: { size?: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.27 }]}>
      <BrandMark size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { backgroundColor: BRAND_TERRACOTTA, overflow: 'hidden' },
});
