import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenBackground } from '../components/ScreenBackground';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { GradientButton } from '../components/GradientButton';
import { Logo } from '../components/Logo';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { getArqueos, wasModifiedAfterClose, deleteArqueo } from '../services/arqueos';
import { Arqueo } from '../types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [arqueos, setArqueos] = useState<Arqueo[]>([]);
  const [modifiedFlags, setModifiedFlags] = useState<Record<number, boolean>>({});

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

  return (
    <ScreenBackground>
      <View style={styles.header}>
        <Logo size={34} />
        <Pressable onPress={() => navigation.navigate('Settings')} style={styles.avatarBtn}>
          <Text style={styles.avatarText}>{(user?.displayName ?? '?').slice(0, 1).toUpperCase()}</Text>
        </Pressable>
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
      </View>

      <FlatList
        data={arqueos}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="package" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Aún no hay arqueos. Crea el primero para empezar a escanear.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate(item.status === 'abierto' ? 'Scanner' : 'ArqueoDetail', { arqueoId: item.id } as any)
            }
            onLongPress={() => handleLongPress(item)}
          >
            <Card style={styles.arqueoCard}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.arqueoName, { color: colors.textPrimary }]}>{item.nombre}</Text>
                <Text style={[styles.arqueoMeta, { color: colors.textMuted }]}>
                  {item.zona ? `${item.zona} · ` : ''}
                  {new Date(item.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {' · '}
                  {item.createdBy}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Badge label={item.status} tone={item.status === 'abierto' ? 'info' : 'success'} />
                {modifiedFlags[item.id] && <Badge label="Modificado" tone="warning" />}
              </View>
            </Card>
          </Pressable>
        )}
      />

      <View style={styles.fabWrap}>
        <GradientButton
          label="Nuevo arqueo"
          icon={<Feather name="camera" size={18} color="#fff" />}
          onPress={() => navigation.navigate('NewArqueo')}
        />
      </View>
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
  arqueoCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  arqueoName: { fontSize: 15, fontWeight: '800' },
  arqueoMeta: { fontSize: 11, fontWeight: '600', marginTop: 4, textTransform: 'capitalize' },
  empty: { alignItems: 'center', marginTop: 60, gap: 12, paddingHorizontal: 30 },
  emptyText: { textAlign: 'center', fontSize: 13, fontWeight: '600' },
  fabWrap: { position: 'absolute', bottom: 24, left: 20, right: 20 },
});
