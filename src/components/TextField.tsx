import React from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 4 }}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            borderColor: error ? colors.destructive : colors.borderLine,
            backgroundColor: colors.input,
            color: colors.textPrimary,
          },
          style,
        ]}
        {...rest}
      />
      {error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderRadius: radius.lg * 0.6,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    fontWeight: '600',
  },
  error: { fontSize: 12, marginTop: 4, fontWeight: '600' },
});
