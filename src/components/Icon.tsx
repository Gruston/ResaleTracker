import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home'
  | 'trips'
  | 'items'
  | 'insights'
  | 'more'
  | 'chev'
  | 'back'
  | 'search'
  | 'camera'
  | 'calc'
  | 'plus'
  | 'check'
  | 'close'
  | 'spark'
  | 'calendar';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Simple stroke icons (24x24 grid) from the prototype. Decorative: put the label on the parent button. */
export function Icon({ name, size = 22, color = '#1E1C1A', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {glyph(name)}
    </Svg>
  );
}

function glyph(name: IconName) {
  switch (name) {
    case 'home':
      return <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />;
    case 'trips':
      return (
        <>
          <Path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
          <Path d="M9 8h6M9 12h6" />
        </>
      );
    case 'items':
      return (
        <>
          <Path d="M20 12l-8 8-9-9V3h8z" />
          <Circle cx={7.5} cy={7.5} r={1.5} />
        </>
      );
    case 'insights':
      return <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />;
    case 'more':
      return (
        <>
          <Circle cx={5} cy={12} r={1.5} />
          <Circle cx={12} cy={12} r={1.5} />
          <Circle cx={19} cy={12} r={1.5} />
        </>
      );
    case 'chev':
      return <Path d="M9 6l6 6-6 6" />;
    case 'back':
      return <Path d="M15 6l-6 6 6 6" />;
    case 'search':
      return (
        <>
          <Circle cx={11} cy={11} r={7} />
          <Path d="M20 20l-4-4" />
        </>
      );
    case 'camera':
      return (
        <>
          <Path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <Circle cx={12} cy={13} r={3.5} />
        </>
      );
    case 'calc':
      return (
        <>
          <Rect x={5} y={3} width={14} height={18} rx={2} />
          <Path d="M8 7h8M8 11h2M12 11h2M8 15h2M12 15h2M8 18h2M12 18h2" />
        </>
      );
    case 'plus':
      return <Path d="M12 5v14M5 12h14" />;
    case 'check':
      return <Path d="M5 12.5l4.5 4.5L19 7.5" />;
    case 'close':
      return <Path d="M6 6l12 12M18 6L6 18" />;
    case 'spark':
      return <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />;
    case 'calendar':
      return <Path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5" />;
  }
}
