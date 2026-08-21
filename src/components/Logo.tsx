import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { brand } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { LogoIcon } from './LogoIcon';

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
}

/** Logo real de KPIsManageX: ícono SVG + wordmark, fiel al branding web. */
export function Logo({ size = 40, showWordmark = true }: LogoProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <LogoIcon size={size} />
      {showWordmark && (
        <Text style={[styles.wordmark, { fontSize: size * 0.5, color: colors.textPrimary }]}>
          KPIs
          <Text style={{ color: brand.emerald }}>Manage</Text>
          <Text style={{ color: brand.cyan }}>X</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});
