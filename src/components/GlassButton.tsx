import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, PressableProps } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

interface GlassButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function GlassButton({ label, icon, style, onPress, ...rest }: GlassButtonProps) {
  const { mode, colors } = useTheme();
  return (
    <Pressable
      onPress={(e) => {
        Haptics.selectionAsync();
        onPress?.(e);
      }}
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }, style]}
      {...rest}
    >
      <BlurView
        intensity={40}
        tint={mode === 'dark' ? 'dark' : 'light'}
        style={[styles.blur, { borderColor: colors.borderLine }]}
      >
        {icon}
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  blur: {
    borderRadius: radius.lg * 0.7,
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  label: { fontWeight: '700', fontSize: 15 },
});
