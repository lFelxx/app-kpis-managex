import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenBackground } from '../components/ScreenBackground';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { GradientButton } from '../components/GradientButton';
import { TextField } from '../components/TextField';
import { Logo } from '../components/Logo';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { getArqueos, wasModifiedAfterClose, deleteArqueo, mergeArqueos } from '../services/arqueos';
import { Arqueo } from '../types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [arqueos, setArqueos] = useState<Arqueo[]>([]);
  const [modifiedFlags, setModifiedFlags] = useState<Record<number, boolean>>({});
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [merging, setMerging] = useState(false);

  const load = useCallback(async () => {
    const data = await getArqueos();
    setArqueos(data);
    const flags: Record<number, boolean> = {};
    for (const a of data) {
      if (a.status === 'cerrado') flags[a.id] = await wasModifiedAfterClose(a);
    }
    setModifiedFlags(flags);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const abiertos = arqueos.filter((a) => a.status === 'abierto').length;
  const cerrados = arqueos.filter((a) => a.status === 'cerrado');

  const handleLongPress = (item: Arqueo) => {
    if (!user?.isAdmin) return;
    Alert.alert(
      'Eliminar arqueo',
      `¿Borrar "${item.nombre}" permanentemente? Úsalo solo si fue un arqueo fallido o mal creado — no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteArqueo(item.id);
            load();
          },
        },
      ]
    );
  };

  const toggleSelectMode = () => {
    setSelectMode((s) => !s);
    setSelectedIds(new Set());
  };

  const toggleSelected = (item: Arqueo) => {
    if (item.status !== 'cerrado') return; // solo se unifican arqueos ya cerrados
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const handleRowPress = (item: Arqueo) => {
    if (selectMode) {
      toggleSelected(item);
    } else {
      navigation.navigate(item.status === 'abierto' ? 'Scanner' : 'ArqueoDetail', { arqueoId: item.id } as any);
    }
  };

  const handleConfirmMerge = async () => {
    if (!mergeName.trim() || selectedIds.size < 2 || !user) return;
    setMerging(true);
    try {
      const nuevo = await mergeArqueos(Array.from(selectedIds), mergeName, user.displayName);
      setMergeOpen(false);
      setMergeName('');
      setSelectMode(false);
      setSelectedIds(new Set());
      load();
      navigation.navigate('ArqueoDetail', { arqueoId: nuevo.id });
    } catch (e: any) {
      Alert.alert('No se pudo unificar', e.message ?? 'Intenta de nuevo');
    } finally {
      setMerging(false);
    }
  };

  return (
    <ScreenBackground>
      <View style={styles.header}>
        <Logo size={34} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {cerrados.length >= 2 && (
            <Pressable
              onPress={toggleSelectMode}
              style={[styles.avatarBtn, selectMode && { backgroundColor: '#10B981' }]}
            >
              <Feather name="layers" size={16} color={selectMode ? '#fff' : '#10B981'} />
            </Pressable>
          )}
          <Pressable onPress={() => navigation.navigate('Settings')} style={styles.avatarBtn}>
            <Text style={styles.avatarText}>{(user?.displayName ?? '?').slice(0, 1).toUpperCase()}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={[styles.statLabel, { color: colors.textMicro }]}>ARQUEOS ABIERTOS</Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{abiertos}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statLabel, { color: colors.textMicro }]}>TOTAL REGISTRADOS</Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{arqueos.length}</Text>
        </Card>
      </View>

      <View style={styles.listHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Arqueos</Text>
        {selectMode && (
          <Text style={[styles.selectHint, { color: colors.textMuted }]}>
            Toca los arqueos cerrados que quieras unificar ({selectedIds.size} seleccionados)
          </Text>
        )}
      </View>

      <FlatList
        data={arqueos}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="package" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Aún no hay arqueos. Crea el primero para empezar a escanear.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSelectable = selectMode && item.status === 'cerrado';
          const isSelected = selectedIds.has(item.id);
          return (
            <Pressable
              onPress={() => handleRowPress(item)}
              onLongPress={() => !selectMode && handleLongPress(item)}
              disabled={selectMode && item.status !== 'cerrado'}
            >
              <Card
                style={[
                  styles.arqueoCard,
                  isSelected && { borderColor: '#10B981', borderWidth: 2 },
                  selectMode && item.status !== 'cerrado' && { opacity: 0.4 },
                ]}
              >
                {selectMode && (
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: colors.borderLine },
                      isSelected && { backgroundColor: '#10B981', borderColor: '#10B981' },
                    ]}
                  >
                    {isSelected && <Feather name="check" size={12} color="#fff" />}
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.arqueoName, { color: colors.textPrimary }]}>
                    {item.modo === 'style_beta' ? '⚡ ' : ''}
                    {item.nombre}
                  </Text>
                  <Text style={[styles.arqueoMeta, { color: colors.textMuted }]}>
                    {item.zona ? `${item.zona} · ` : ''}
                    {new Date(item.createdAt).toLocaleDateString('es-CO', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {' · '}
                    {item.createdBy}
                  </Text>
                </View>
                {!selectMode && (
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Badge label={item.status} tone={item.status === 'abierto' ? 'info' : 'success'} />
                    {modifiedFlags[item.id] && <Badge label="Modificado" tone="warning" />}
                  </View>
                )}
              </Card>
            </Pressable>
          );
        }}
      />

      <View style={styles.fabWrap}>
        {selectMode ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={styles.cancelSelectBtn} onPress={toggleSelectMode}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancelar</Text>
            </Pressable>
            <GradientButton
              label={`Unificar (${selectedIds.size})`}
              icon={<Feather name="layers" size={18} color="#fff" />}
              onPress={() => setMergeOpen(true)}
              disabled={selectedIds.size < 2}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <GradientButton
            label="Nuevo arqueo"
            icon={<Feather name="camera" size={18} color="#fff" />}
            onPress={() => navigation.navigate('NewArqueo')}
          />
        )}
      </View>

      <Modal visible={mergeOpen} animationType="fade" transparent onRequestClose={() => setMergeOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMergeOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={[styles.mergeCard, { backgroundColor: colors.card, borderColor: colors.borderLine }]}>
              <Text style={[styles.mergeTitle, { color: colors.textPrimary }]}>Unificar {selectedIds.size} arqueos</Text>
              <Text style={[styles.mergeSubtitle, { color: colors.textMuted }]}>
                Se crea un arqueo nuevo con los códigos sumados de todos los seleccionados. Los arqueos originales no
                se modifican ni se borran.
              </Text>
              <TextField
                placeholder='Ej: "Total tienda — semana 34"'
                value={mergeName}
                onChangeText={setMergeName}
                autoFocus
                style={{ marginTop: 14 }}
              />
              <GradientButton
                label={merging ? 'Unificando…' : 'Crear arqueo unificado'}
                onPress={handleConfirmMerge}
                disabled={!mergeName.trim() || merging}
                loading={merging}
                style={{ marginTop: 12 }}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#10B98122',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#10B981', fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 20 },
  statCard: { flex: 1, paddingVertical: 16 },
  statLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statValue: { fontSize: 26, fontWeight: '900', marginTop: 6, letterSpacing: -1 },
  listHeader: { paddingHorizontal: 20, marginTop: 26, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  selectHint: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  arqueoCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arqueoName: { fontSize: 15, fontWeight: '800' },
  arqueoMeta: { fontSize: 11, fontWeight: '600', marginTop: 4, textTransform: 'capitalize' },
  empty: { alignItems: 'center', marginTop: 60, gap: 12, paddingHorizontal: 30 },
  emptyText: { textAlign: 'center', fontSize: 13, fontWeight: '600' },
  fabWrap: { position: 'absolute', bottom: 24, left: 20, right: 20 },
  cancelSelectBtn: { justifyContent: 'center', paddingHorizontal: 16 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 },
  mergeCard: { width: '100%', maxWidth: 400, borderRadius: 20, borderWidth: 1, padding: 20 },
  mergeTitle: { fontSize: 18, fontWeight: '900' },
  mergeSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 6, lineHeight: 17 },
});
