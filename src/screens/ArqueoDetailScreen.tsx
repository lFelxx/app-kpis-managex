import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenBackground } from '../components/ScreenBackground';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { ItemRow } from '../components/ItemRow';
import { CommentSheet } from '../components/CommentSheet';
import { GradientButton } from '../components/GradientButton';
import { GlassButton } from '../components/GlassButton';
import { TextField } from '../components/TextField';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import {
  getArqueo,
  getItems,
  updateItem,
  updateArqueoNotas,
  renameArqueo,
  getAuditLog,
  wasModifiedAfterClose,
  reopenArqueo,
  deleteArqueo,
} from '../services/arqueos';
import { generateExportFile, generatePosExportFile, shareExport, emailExport } from '../services/export';
import { Arqueo, ArqueoItem, AuditLogEntry, ExportFormat, ExportMode } from '../types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ArqueoDetail'>;

const FORMATS: { key: ExportFormat; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'xlsx', label: 'Excel (.xlsx)', icon: 'grid' },
  { key: 'csv', label: 'CSV (.csv)', icon: 'list' },
  { key: 'txt', label: 'Texto (.txt)', icon: 'file-text' },
];

export function ArqueoDetailScreen({ route, navigation }: Props) {
  const { arqueoId } = route.params;
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [arqueo, setArqueo] = useState<Arqueo | null>(null);
  const [items, setItems] = useState<ArqueoItem[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [modified, setModified] = useState(false);
  const [selected, setSelected] = useState<ArqueoItem | null>(null);
  const [notas, setNotas] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode | null>(null);
  const [busyFormat, setBusyFormat] = useState<ExportFormat | 'pos' | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  const load = useCallback(async () => {
    const a = await getArqueo(arqueoId);
    const its = await getItems(arqueoId);
    setArqueo(a);
    setItems(its);
    setNotas(a?.notas ?? '');
    if (a) {
      setModified(await wasModifiedAfterClose(a));
      setAudit(await getAuditLog(arqueoId));
    }
  }, [arqueoId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!arqueo) return <ScreenBackground><View /></ScreenBackground>;

  const totalUnidades = items.reduce((s, i) => s + i.cantidad, 0);
  const filteredItems = itemSearch.trim()
    ? items.filter(
        (i) =>
          i.codigo.toLowerCase().includes(itemSearch.trim().toLowerCase()) ||
          i.comentario?.toLowerCase().includes(itemSearch.trim().toLowerCase())
      )
    : items;

  const handleSaveItem = async (data: { comentario: string; cantidad: number }) => {
    if (!selected) return;
    await updateItem(
      selected,
      { comentario: data.comentario || null, cantidad: data.cantidad },
      user?.displayName ?? 'desconocido'
    );
    setSelected(null);
    load();
  };

  const handleSaveNotas = async () => {
    await updateArqueoNotas(arqueoId, notas, user?.displayName ?? 'desconocido');
    load();
  };

  const openRename = () => {
    setRenameValue(arqueo.nombre);
    setRenameOpen(true);
  };

  const handleRename = async () => {
    await renameArqueo(arqueoId, renameValue, user?.displayName ?? 'desconocido');
    setRenameOpen(false);
    load();
  };

  const doExport = async (format: ExportFormat, action: 'share' | 'email') => {
    setBusyFormat(format);
    try {
      const file = await generateExportFile(arqueo, items, format);
      if (action === 'share') {
        await shareExport(file);
      } else {
        await emailExport(file, `Arqueo ${arqueo.nombre} — ${new Date(arqueo.createdAt).toLocaleDateString('es-CO')}`);
      }
    } catch (e: any) {
      Alert.alert('No se pudo exportar', e.message ?? 'Intenta de nuevo');
    } finally {
      setBusyFormat(null);
      closeExportModal();
    }
  };

  const doExportPos = async (action: 'share' | 'email') => {
    setBusyFormat('pos');
    try {
      const file = await generatePosExportFile(arqueo, items);
      if (action === 'share') {
        await shareExport(file);
      } else {
        await emailExport(file, `Arqueo ${arqueo.nombre} — Sistema POS`);
      }
    } catch (e: any) {
      Alert.alert('No se pudo exportar', e.message ?? 'Intenta de nuevo');
    } finally {
      setBusyFormat(null);
      closeExportModal();
    }
  };

  const closeExportModal = () => {
    setExportOpen(false);
    setExportMode(null);
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar arqueo',
      `Esto borra permanentemente "${arqueo.nombre}" y sus ${items.length} ítems escaneados. Úsalo solo si fue un arqueo fallido o mal creado — no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteArqueo(arqueoId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleReopen = () => {
    Alert.alert('Reabrir arqueo', '¿Seguro que quieres reabrir este arqueo para seguir escaneando o editando?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reabrir',
        onPress: async () => {
          await reopenArqueo(arqueoId, user?.displayName ?? 'desconocido');
          navigation.replace('Scanner', { arqueoId });
        },
      },
    ]);
  };

  return (
    <ScreenBackground>
      <View style={styles.headerRow}>
        <Feather name="arrow-left" size={22} color={colors.textPrimary} onPress={() => navigation.goBack()} />
        <Pressable onPress={openRename} style={styles.headerTitleWrap} hitSlop={8}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {arqueo.nombre}
          </Text>
          <Feather name="edit-2" size={13} color={colors.textMuted} />
        </Pressable>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <View style={styles.badgeRow}>
          <Badge label={arqueo.status} tone={arqueo.status === 'abierto' ? 'info' : 'success'} />
          {modified && <Badge label="Modificado tras cierre" tone="warning" />}
          {arqueo.zona && <Badge label={arqueo.zona} tone="neutral" />}
        </View>

        <Card style={{ marginTop: 14 }}>
          <View style={styles.statsRow}>
            <View>
              <Text style={[styles.statLabel, { color: colors.textMicro }]}>ÍTEMS</Text>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{items.length}</Text>
            </View>
            <View>
              <Text style={[styles.statLabel, { color: colors.textMicro }]}>UNIDADES</Text>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{totalUnidades}</Text>
            </View>
            <View>
              <Text style={[styles.statLabel, { color: colors.textMicro }]}>RESPONSABLE</Text>
              <Text style={[styles.statValueSm, { color: colors.textPrimary }]}>{arqueo.createdBy}</Text>
            </View>
          </View>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>
            Creado {new Date(arqueo.createdAt).toLocaleString('es-CO')}
            {arqueo.closedAt ? ` · Cerrado ${new Date(arqueo.closedAt).toLocaleString('es-CO')}` : ''}
          </Text>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notas generales</Text>
        <Card>
          <TextField
            placeholder='Ej: "Hecho por Ana y Luis" — comentarios generales del arqueo'
            value={notas}
            onChangeText={setNotas}
            onBlur={handleSaveNotas}
            multiline
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ítems escaneados</Text>
        {items.length > 3 && (
          <TextField
            placeholder="Buscar código o comentario…"
            value={itemSearch}
            onChangeText={setItemSearch}
            autoCapitalize="none"
            style={{ marginBottom: 10 }}
          />
        )}
        {filteredItems.length === 0 && itemSearch.trim() ? (
          <Text style={[styles.emptySearchText, { color: colors.textMuted }]}>Ningún código coincide con "{itemSearch}".</Text>
        ) : (
          filteredItems.map((item) => <ItemRow key={item.id} item={item} onPress={() => setSelected(item)} />)
        )}

        {audit.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Auditoría de cambios</Text>
            <Card>
              {audit.map((entry) => (
                <View key={entry.id} style={styles.auditRow}>
                  <Feather name="edit-2" size={12} color={colors.textMuted} />
                  <Text style={[styles.auditText, { color: colors.textSecondary }]}>
                    <Text style={{ fontWeight: '800' }}>{entry.cambiadoPor}</Text> cambió {entry.campo}:{' '}
                    {entry.valorAnterior ?? '—'} → {entry.valorNuevo ?? '—'}
                    {'  '}
                    <Text style={{ color: colors.textMuted }}>
                      {new Date(entry.cambiadoEn).toLocaleString('es-CO')}
                    </Text>
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}

        <View style={styles.actionsRow}>
          {arqueo.status === 'cerrado' && <GlassButton label="Reabrir" icon={<Feather name="unlock" size={16} color={colors.textPrimary} />} onPress={handleReopen} style={{ flex: 1 }} />}
          <GradientButton
            label="Exportar / Enviar"
            icon={<Feather name="share" size={16} color="#fff" />}
            onPress={() => setExportOpen(true)}
            style={{ flex: 1 }}
          />
        </View>

        {user?.isAdmin && (
          <Pressable onPress={handleDelete} style={styles.deleteRow}>
            <Feather name="trash-2" size={14} color={colors.destructive} />
            <Text style={[styles.deleteText, { color: colors.destructive }]}>Eliminar arqueo (fallido o mal creado)</Text>
          </Pressable>
        )}
      </ScrollView>

      <CommentSheet
        visible={!!selected}
        codigo={selected?.codigo ?? ''}
        cantidad={selected?.cantidad ?? 0}
        initialComment={selected?.comentario}
        onClose={() => setSelected(null)}
        onSave={handleSaveItem}
      />

      <Modal visible={renameOpen} animationType="fade" transparent onRequestClose={() => setRenameOpen(false)}>
        <View style={styles.renameOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenameOpen(false)} />
          <View style={[styles.renameCard, { backgroundColor: colors.card, borderColor: colors.borderLine }]}>
            <Text style={[styles.exportTitle, { color: colors.textPrimary }]}>Renombrar arqueo</Text>
            <Text style={[styles.exportSubtitle, { color: colors.textMuted }]}>
              El cambio queda registrado en la auditoría de este arqueo.
            </Text>
            <TextField value={renameValue} onChangeText={setRenameValue} autoFocus placeholder="Nombre del arqueo" />
            <GradientButton
              label="Guardar nombre"
              onPress={handleRename}
              disabled={!renameValue.trim()}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={exportOpen} animationType="slide" transparent onRequestClose={closeExportModal}>
        <View style={styles.exportOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeExportModal} />
          <View style={[styles.exportSheet, { backgroundColor: colors.card, borderColor: colors.borderLine }]}>
            <View style={styles.sheetHandle} />

            {exportMode === null && (
              <>
                <Text style={[styles.exportTitle, { color: colors.textPrimary }]}>¿Para qué es esta exportación?</Text>
                <Text style={[styles.exportSubtitle, { color: colors.textMuted }]}>Elige el destino del archivo</Text>

                <Pressable
                  onPress={() => setExportMode('pos')}
                  style={[styles.modeCard, { borderColor: colors.borderLine, backgroundColor: colors.subtle }]}
                >
                  <View style={[styles.modeIcon, { backgroundColor: '#10B98122' }]}>
                    <Feather name="upload" size={18} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeTitle, { color: colors.textPrimary }]}>Sistema POS</Text>
                    <Text style={[styles.modeDesc, { color: colors.textMuted }]}>
                      .txt limpio: solo el código/SKU escaneado, una línea por unidad. Sin cantidades ni comentarios —
                      listo para subir directo a tu sistema.
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </Pressable>

                <Pressable
                  onPress={() => setExportMode('completo')}
                  style={[styles.modeCard, { borderColor: colors.borderLine, backgroundColor: colors.subtle }]}
                >
                  <View style={[styles.modeIcon, { backgroundColor: '#00F2FE22' }]}>
                    <Feather name="archive" size={18} color="#22d3ee" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeTitle, { color: colors.textPrimary }]}>Formato para almacenar</Text>
                    <Text style={[styles.modeDesc, { color: colors.textMuted }]}>
                      Reporte completo con cantidades, comentarios, fechas y checksum de integridad. Para tu respaldo
                      interno (Excel, CSV o TXT).
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </Pressable>
              </>
            )}

            {exportMode === 'pos' && (
              <>
                <View style={styles.exportHeaderRow}>
                  <Pressable onPress={() => setExportMode(null)} hitSlop={10}>
                    <Feather name="arrow-left" size={18} color={colors.textPrimary} />
                  </Pressable>
                  <Text style={[styles.exportTitle, { color: colors.textPrimary }]}>Sistema POS</Text>
                  <View style={{ width: 18 }} />
                </View>
                <Text style={[styles.exportSubtitle, { color: colors.textMuted }]}>
                  {items.reduce((s, i) => s + i.cantidad, 0)} líneas · solo códigos, sin cantidad ni comentarios
                </Text>
                <View style={[styles.formatRow, { borderColor: colors.borderLine }]}>
                  <View style={styles.formatLabel}>
                    <Feather name="file-text" size={18} color={colors.textPrimary} />
                    <Text style={[styles.formatText, { color: colors.textPrimary }]}>Texto (.txt)</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => doExportPos('share')}
                      disabled={busyFormat !== null}
                      style={[styles.smallBtn, { borderColor: colors.borderLine }]}
                    >
                      <Feather name="share-2" size={14} color={colors.textPrimary} />
                    </Pressable>
                    <Pressable
                      onPress={() => doExportPos('email')}
                      disabled={busyFormat !== null}
                      style={[styles.smallBtn, { borderColor: colors.borderLine }]}
                    >
                      <Feather name="mail" size={14} color={colors.textPrimary} />
                    </Pressable>
                  </View>
                </View>
              </>
            )}

            {exportMode === 'completo' && (
              <>
                <View style={styles.exportHeaderRow}>
                  <Pressable onPress={() => setExportMode(null)} hitSlop={10}>
                    <Feather name="arrow-left" size={18} color={colors.textPrimary} />
                  </Pressable>
                  <Text style={[styles.exportTitle, { color: colors.textPrimary }]}>Formato completo</Text>
                  <View style={{ width: 18 }} />
                </View>
                <Text style={[styles.exportSubtitle, { color: colors.textMuted }]}>Elige un formato y cómo enviarlo</Text>

                {FORMATS.map((f) => (
                  <View key={f.key} style={[styles.formatRow, { borderColor: colors.borderLine }]}>
                    <View style={styles.formatLabel}>
                      <Feather name={f.icon} size={18} color={colors.textPrimary} />
                      <Text style={[styles.formatText, { color: colors.textPrimary }]}>{f.label}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        onPress={() => doExport(f.key, 'share')}
                        disabled={busyFormat !== null}
                        style={[styles.smallBtn, { borderColor: colors.borderLine }]}
                      >
                        <Feather name="share-2" size={14} color={colors.textPrimary} />
                      </Pressable>
                      <Pressable
                        onPress={() => doExport(f.key, 'email')}
                        disabled={busyFormat !== null}
                        style={[styles.smallBtn, { borderColor: colors.borderLine }]}
                      >
                        <Feather name="mail" size={14} color={colors.textPrimary} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </>
            )}

            <Text style={[styles.exportHint, { color: colors.textMicro }]}>
              El ícono de compartir abre el menú nativo (AirDrop, Drive, WhatsApp, etc.). El de correo abre tu app de
              mail con el archivo adjunto listo para enviar.
            </Text>
          </View>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 10,
  },
  headerTitle: { fontSize: 16, fontWeight: '900', flexShrink: 1 },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statValue: { fontSize: 22, fontWeight: '900', marginTop: 4 },
  statValueSm: { fontSize: 13, fontWeight: '800', marginTop: 6 },
  dateText: { fontSize: 11, fontWeight: '600', marginTop: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '900', marginTop: 22, marginBottom: 10 },
  emptySearchText: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 10 },
  auditRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 10 },
  auditText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 26 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, padding: 10 },
  deleteText: { fontSize: 12, fontWeight: '800' },
  exportOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  exportSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 20, paddingBottom: 36 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#9CA3AF44', alignSelf: 'center', marginBottom: 14 },
  exportTitle: { fontSize: 18, fontWeight: '900' },
  exportSubtitle: { fontSize: 12, fontWeight: '600', marginBottom: 16, marginTop: 2 },
  exportHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  modeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontSize: 14, fontWeight: '800' },
  modeDesc: { fontSize: 11, fontWeight: '600', marginTop: 3, lineHeight: 15 },
  formatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  formatLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  formatText: { fontSize: 13, fontWeight: '700' },
  smallBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  exportHint: { fontSize: 11, fontWeight: '600', marginTop: 6, lineHeight: 16 },
  renameOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 },
  renameCard: { width: '100%', maxWidth: 380, borderRadius: 20, borderWidth: 1, padding: 20, gap: 12 },
});
