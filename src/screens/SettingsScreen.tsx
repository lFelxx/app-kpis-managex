import React from 'react';
import { View, Text, StyleSheet, Pressable, Switch, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { ScreenBackground } from '../components/ScreenBackground';
import { Card } from '../components/Card';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { colors, mode, toggle } = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const lock = useAuthStore((s) => s.lock);

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScreenBackground>
      <View style={styles.headerRow}>
        <Feather name="arrow-left" size={22} color={colors.textPrimary} onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Ajustes</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={{ padding: 20, gap: 14 }}>
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.displayName ?? '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={[styles.name, { color: colors.textPrimary }]}>{user?.displayName}</Text>
            <Text style={[styles.username, { color: colors.textMuted }]}>@{user?.username}</Text>
          </View>
        </Card>

        <Card>
          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Feather name={mode === 'dark' ? 'moon' : 'sun'} size={18} color={colors.textPrimary} />
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>Modo oscuro</Text>
            </View>
            <Switch value={mode === 'dark'} onValueChange={toggle} trackColor={{ true: '#10B981' }} />
          </View>
        </Card>

        {user?.isAdmin && (
          <Pressable onPress={() => navigation.navigate('Employees')}>
            <Card>
              <View style={styles.row}>
                <View style={styles.rowLabel}>
                  <Feather name="users" size={18} color={colors.textPrimary} />
                  <Text style={[styles.rowText, { color: colors.textPrimary }]}>Administrar empleados</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </Card>
          </Pressable>
        )}

        <Pressable onPress={lock}>
          <Card>
            <View style={styles.row}>
              <View style={styles.rowLabel}>
                <Feather name="lock" size={18} color={colors.textPrimary} />
                <Text style={[styles.rowText, { color: colors.textPrimary }]}>Bloquear ahora</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </View>
          </Card>
        </Pressable>

        <Pressable onPress={handleLogout}>
          <Card>
            <View style={styles.row}>
              <View style={styles.rowLabel}>
                <Feather name="log-out" size={18} color={colors.destructive} />
                <Text style={[styles.rowText, { color: colors.destructive }]}>Cerrar sesión</Text>
              </View>
            </View>
          </Card>
        </Pressable>

        <Text style={[styles.version, { color: colors.textMicro }]}>
          KPIManageX · Arqueos v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#10B98122', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#10B981', fontWeight: '900', fontSize: 20 },
  name: { fontSize: 16, fontWeight: '900' },
  username: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { fontSize: 14, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 10 },
});
