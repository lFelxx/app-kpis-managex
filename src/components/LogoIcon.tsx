import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

/**
 * Ícono real de KPIsManageX (logo-icon.svg del proyecto kpis-management),
 * renderizado como SVG nativo para máxima nitidez en cualquier tamaño.
 */
export function LogoIcon({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path
        d="M20 1.5L36.5 11V29L20 38.5L3.5 29V11L20 1.5Z"
        fill="#101214"
        stroke="#4B5563"
        strokeWidth={1}
        strokeDasharray="3.4 3"
      />
      <Path d="M12.5 11.5V28.5" stroke="#10B981" strokeWidth={3.4} strokeLinecap="round" />
      <Path
        d="M22.5 11.5L13.8 20L22.5 28.5"
        stroke="#10B981"
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M28.5 11.5L19.8 20L28.5 28.5"
        stroke="#00F2FE"
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={20} cy={20} r={1.7} fill="#FFFFFF" />
    </Svg>
  );
}
