import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { brand } from '../theme/tokens';

/**
 * Fondo estándar de pantalla con los "aurora blobs" translúcidos
 * (emerald/cyan) que ya se usan en kpis-management sobre cards y login.
 */
export function ScreenBackground({ children, edges }: { children: React.ReactNode; edges?: ('top' | 'bottom' | 'left' | 'right')[] }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.blobGreen, { backgroundColor: brand.emerald }]} />
      <View style={[styles.blobCyan, { backgroundColor: brand.cyan }]} />
      <SafeAreaView style={styles.safe} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  blobGreen: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -80,
    right: -80,
    opacity: 0.12,
  },
  blobCyan: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: -60,
    left: -60,
    opacity: 0.1,
  },
});
