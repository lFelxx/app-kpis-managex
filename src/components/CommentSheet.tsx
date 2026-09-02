import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, brand, status } from '../theme/tokens';
import { COMENTARIO_SUGERIDOS, ResolutionSource } from '../types';
import { TextField } from './TextField';
import { GradientButton } from './GradientButton';
import { Badge } from './Badge';
import { Feather } from '@expo/vector-icons';

const SOURCE_LABEL: Record<ResolutionSource, string> = {
  cache: 'Automático (caché)',
  ocr: 'Leído de la etiqueta',
  api_model: 'Automático (API)',
  api_regex: 'Automático (API)',
  manual: 'Manual',
  none: 'Sin resolver',
};

interface CommentSheetProps {
  visible: boolean;
  codigo: string;
  cantidad: number;
  initialComment?: string | null;
  detalle?: string | null;
  styleNumber?: string | null;
  resolutionSource?: ResolutionSource | null;
  onClose: () => void;
  onSave: (data: { comentario: string; cantidad: number }) => void;
  onDelete?: () => void;
  onSetStyleNumber?: (value: string) => void;
  onRetryPhoto?: () => void;
}

export function CommentSheet({
  visible,
  codigo,
  cantidad,
  initialComment,
  detalle,
  styleNumber,
  resolutionSource,
  onClose,
  onSave,
  onDelete,
  onSetStyleNumber,
  onRetryPhoto,
}: CommentSheetProps) {
  const { colors } = useTheme();
  const [text, setText] = useState(initialComment ?? '');
  const [qty, setQty] = useState(cantidad);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingStyle, setEditingStyle] = useState(false);
  const [styleValue, setStyleValue] = useState(styleNumber ?? '');

  useEffect(() => {
    if (visible) {
      setText(initialComment ?? '');
      setQty(cantidad);
      setConfirmDelete(false);
      setStyleValue(styleNumber ?? '');
      setEditingStyle(resolutionSource === 'none');
    }
  }, [visible, initialComment, cantidad, styleNumber, resolutionSource]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.borderLine }]}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.eyebrow, { color: colors.textMicro }]}>ÍTEM ESCANEADO</Text>
                <Text style={[styles.codigo, { color: colors.textPrimary }]} numberOfLines={1}>
                  {codigo}
                </Text>
              </View>
              {onDelete && (
                <Pressable
                  onPress={() => setConfirmDelete(true)}
                  style={[styles.trashBtn, { borderColor: `${status.error}40` }]}
                >
                  <Feather name="trash-2" size={16} color={status.error} />
                </Pressable>
              )}
            </View>

            {confirmDelete ? (
              <View style={[styles.confirmBox, { backgroundColor: `${status.error}12`, borderColor: `${status.error}40` }]}>
                <Text style={[styles.confirmText, { color: colors.textPrimary }]}>
                  ¿Quitar este código del arqueo? Se borran sus {cantidad} unidad{cantidad === 1 ? '' : 'es'} escaneadas.
                </Text>
                <View style={styles.confirmActions}>
                  <Pressable style={styles.cancelBtn} onPress={() => setConfirmDelete(false)}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancelar</Text>
                  </Pressable>
                  <GradientButton
                    label="Sí, quitar"
                    variant="danger"
                    icon={<Feather name="trash-2" size={16} color="#fff" />}
                    style={{ flex: 1 }}
                    onPress={onDelete}
                  />
                </View>
              </View>
            ) : (
              <>
                {resolutionSource && (
                  <View style={styles.styleBlock}>
                    <View style={styles.styleHeaderRow}>
                      <Badge
                        label={SOURCE_LABEL[resolutionSource]}
                        tone={resolutionSource === 'none' ? 'warning' : 'success'}
                      />
                      {!editingStyle && onSetStyleNumber && (
                        <Pressable onPress={() => setEditingStyle(true)} hitSlop={8}>
                          <Text style={[styles.editLink, { color: brand.emerald }]}>Corregir</Text>
                        </Pressable>
                      )}
                    </View>
                    {detalle && !editingStyle && (
                      <Text style={[styles.detalleText, { color: colors.textMuted }]} numberOfLines={2}>
                        {detalle}
                      </Text>
                    )}
                    {editingStyle && onSetStyleNumber && (
                      <View style={{ marginTop: 8, gap: 8 }}>
                        {resolutionSource === 'none' && onRetryPhoto && (
                          <Pressable
                            onPress={() => {
                              onClose();
                              onRetryPhoto();
                            }}
                            style={[styles.retryPhotoBtn, { borderColor: `${brand.emerald}55` }]}
                          >
                            <Feather name="camera" size={14} color={brand.emerald} />
                            <Text style={[styles.retryPhotoText, { color: brand.emerald }]}>
                              Reintentar con foto
                            </Text>
                          </Pressable>
                        )}
                        <TextField
                          placeholder="Style Number (ej. 385718-01)"
                          value={styleValue}
                          onChangeText={setStyleValue}
                          autoCapitalize="characters"
                        />
                        <Pressable
                          onPress={() => {
                            onSetStyleNumber(styleValue.trim());
                            setEditingStyle(false);
                          }}
                          disabled={!styleValue.trim()}
                          style={[styles.saveStyleBtn, { opacity: styleValue.trim() ? 1 : 0.5 }]}
                        >
                          <Feather name="check" size={14} color={brand.emerald} />
                          <Text style={[styles.saveStyleText, { color: brand.emerald }]}>Guardar Style Number</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}

                <Text style={[styles.label, { color: colors.textSecondary }]}>Cantidad escaneada</Text>
                <View style={styles.stepperRow}>
                  <Pressable
                    onPress={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    style={[styles.stepperBtn, { borderColor: colors.borderLine, opacity: qty <= 1 ? 0.4 : 1 }]}
                  >
                    <Feather name="minus" size={18} color={colors.textPrimary} />
                  </Pressable>
                  <Text style={[styles.qtyValue, { color: colors.textPrimary }]}>{qty}</Text>
                  <Pressable
                    onPress={() => setQty((q) => q + 1)}
                    style={[styles.stepperBtn, { borderColor: colors.borderLine }]}
                  >
                    <Feather name="plus" size={18} color={colors.textPrimary} />
                  </Pressable>
                </View>

                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 18 }]}>Notas rápidas</Text>
                <View style={styles.chipsRow}>
                  {COMENTARIO_SUGERIDOS.map((sug) => (
                    <Pressable
                      key={sug}
                      onPress={() => setText((t) => (t ? `${t}, ${sug}` : sug))}
                      style={[styles.chip, { borderColor: colors.borderLine, backgroundColor: colors.subtle }]}
                    >
                      <Text style={[styles.chipText, { color: colors.textSecondary }]}>{sug}</Text>
                    </Pressable>
                  ))}
                </View>

                <TextField
                  placeholder='Ej: "Hecho por Juan" o "Faltó revisar góndola 3"'
                  value={text}
                  onChangeText={setText}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                />

                <View style={styles.actions}>
                  <Pressable style={styles.cancelBtn} onPress={onClose}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancelar</Text>
                  </Pressable>
                  <GradientButton
                    label="Guardar"
                    icon={<Feather name="check" size={16} color="#fff" />}
                    style={{ flex: 1 }}
                    onPress={() => onSave({ comentario: text.trim(), cantidad: qty })}
                  />
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 32,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#9CA3AF44', alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  codigo: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  trashBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stepperBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { fontSize: 22, fontWeight: '900', minWidth: 40, textAlign: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16, alignItems: 'center' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 14 },
  styleBlock: { marginBottom: 18 },
  styleHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editLink: { fontSize: 12, fontWeight: '800' },
  detalleText: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  saveStyleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  saveStyleText: { fontSize: 12, fontWeight: '800' },
  retryPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
  },
  retryPhotoText: { fontSize: 13, fontWeight: '800' },
  confirmBox: { borderWidth: 1, borderRadius: 16, padding: 16 },
  confirmText: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  confirmActions: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'center' },
});
