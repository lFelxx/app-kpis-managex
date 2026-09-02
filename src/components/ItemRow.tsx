import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { brand, status } from '../theme/tokens';
import { ArqueoItem } from '../types';

interface ItemRowProps {
  item: ArqueoItem;
  onPress?: () => void;
}

export function ItemRow({ item, onPress }: ItemRowProps) {
  const { colors } = useTheme();
  const time = new Date(item.ultimoEscaneo).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: colors.borderLine, backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.qty, { backgroundColor: `${brand.emerald}18` }]}>
        <Text style={{ color: brand.emerald, fontWeight: '900', fontSize: 13 }}>x{item.cantidad}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.codigoRow}>
          <Text style={[styles.codigo, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.codigo}
          </Text>
          {item.resolutionSource === 'none' && (
            <Feather name="alert-triangle" size={12} color={status.warning} />
          )}
        </View>
        {item.detalle ? (
          <Text style={[styles.detalle, { color: colors.textMuted }]} numberOfLines={1}>
            {item.detalle}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{time}</Text>
          {item.comentario ? (
            <View style={styles.commentPill}>
              <Feather name="message-square" size={10} color={colors.textMuted} />
              <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                {item.comentario}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  qty: { minWidth: 40, paddingVertical: 6, borderRadius: 12, alignItems: 'center' },
  codigoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  codigo: { fontSize: 14, fontWeight: '800' },
  detalle: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  meta: { fontSize: 11, fontWeight: '600' },
  commentPill: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
});
