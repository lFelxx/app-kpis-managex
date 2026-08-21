import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, PressableProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { brand, radius } from '../theme/tokens';

interface GradientButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  variant?: 'primary' | 'danger';
}

export function GradientButton({ label, loading, icon, style, variant = 'primary', onPress, disabled, ...rest }: GradientButtonProps) {
  const colors = variant === 'danger' ? (['#f87171', '#ef4444'] as const) : ([brand.emerald, brand.cyanLight] as const);

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={({ pressed }) => [{ opacity: disabled ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
      {...rest}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon}
            <Text style={styles.label}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: radius.lg * 0.7,
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: brand.emerald,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  label: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },
});
