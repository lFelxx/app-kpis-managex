import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { ArqueoItem } from '../types';
import { StyleGroup } from '../utils/styleGroups';
import { ItemRow } from './ItemRow';

interface StyleGroupSheetProps {
  visible: boolean;
  group: StyleGroup | null;
  onClose: () => void;
  onSelectItem: (item: ArqueoItem) => void;
}

/** Muestra los códigos de barras reales (tallas) que se agruparon bajo un
 * mismo style number, para poder editar/corregir cada uno individualmente. */
export function StyleGroupSheet({ visible, group, onClose, onSelectItem }: StyleGroupSheetProps) {
  const { colors } = useTheme();
  if (!group) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.borderLine }]}>
          <View style={styles.handle} />
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {group.label}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {group.items.length} código{group.items.length === 1 ? '' : 's'} de barras distintos · {group.cantidad}{' '}
            unidad{group.cantidad === 1 ? '' : 'es'} en total
          </Text>
          <ScrollView style={{ maxHeight: 340, marginTop: 14 }}>
            {group.items.map((item) => (
              <ItemRow key={item.id} item={item} onPress={() => onSelectItem(item)} />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, padding: 20, paddingBottom: 32 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#9CA3AF44', alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '900' },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
