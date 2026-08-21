import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { status } from '../theme/tokens';

type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const TONE_COLORS: Record<Tone, string> = {
  success: status.success,
  warning: status.warning,
  error: status.error,
  info: status.info,
  neutral: '#9CA3AF',
};

function withAlpha(hex: string, alphaHex: string) {
  return `${hex}${alphaHex}`;
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const color = TONE_COLORS[tone];
  return (
    <View style={[styles.pill, { backgroundColor: withAlpha(color, '20'), borderColor: withAlpha(color, '40') }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
});
