import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenBackground } from '../components/ScreenBackground';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { TextField } from '../components/TextField';
import { GradientButton } from '../components/GradientButton';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import * as authService from '../services/auth';
import { User } from '../types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Employees'>;

export function EmployeesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setUsers(await authService.getAllUsers());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScreenBackground>
      <View style={styles.headerRow}>
        <Feather name="arrow-left" size={22} color={colors.textPrimary} onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Empleados</Text>
        <Pressable onPress={() => setAddOpen(true)} hitSlop={8}>
          <Feather name="user-plus" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {users.map((u) => (
          <Pressable key={u.id} onPress={() => setSelected(u)}>
            <Card style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{u.displayName.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.textPrimary }]}>{u.displayName}</Text>
                <Text style={[styles.username, { color: colors.textMuted }]}>@{u.username}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                {u.isAdmin && <Badge label="Admin" tone="info" />}
                {u.id === currentUser?.userId && <Badge label="Tú" tone="neutral" />}
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>

      <ManageUserModal visible={!!selected} user={selected} onClose={() => setSelected(null)} onChanged={load} />
      <AddEmployeeModal visible={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
    </ScreenBackground>
  );
}

function ManageUserModal({
  visible,
  user,
  onClose,
  onChanged,
}: {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPassword('');
    setConfirm('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleUpdatePassword = async () => {
    if (!user) return;
    if (password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    await authService.resetPassword(user.id, password);
    Alert.alert('Listo', `Contraseña actualizada para ${user.displayName}.`);
    reset();
  };

  const handleClearPin = async () => {
    if (!user) return;
    await authService.setUserPin(user.id, null);
    Alert.alert('Listo', 'Se quitó el PIN de este usuario.');
    onChanged();
  };

  const handleDelete = () => {
    if (!user) return;
    Alert.alert('Eliminar empleado', `¿Borrar la cuenta de ${user.displayName} permanentemente?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await authService.deleteUser(user.id);
          onChanged();
          handleClose();
        },
      },
    ]);
  };

  if (!user) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.borderLine }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>{user.displayName}</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>@{user.username}</Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Restablecer contraseña</Text>
            <View style={{ gap: 10 }}>
              <TextField placeholder="Nueva contraseña" secureTextEntry value={password} onChangeText={setPassword} />
              <TextField placeholder="Confirmar contraseña" secureTextEntry value={confirm} onChangeText={setConfirm} />
            </View>
            {error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
            <GradientButton
              label="Actualizar contraseña"
              onPress={handleUpdatePassword}
              disabled={!password || !confirm}
              style={{ marginTop: 10 }}
            />

            {user.pin && (
              <Pressable onPress={handleClearPin} style={styles.secondaryRow}>
                <Feather name="delete" size={14} color={colors.textSecondary} />
                <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Quitar PIN rápido</Text>
              </Pressable>
            )}

            {!user.isAdmin && (
              <Pressable onPress={handleDelete} style={styles.secondaryRow}>
                <Feather name="trash-2" size={14} color={colors.destructive} />
                <Text style={[styles.secondaryText, { color: colors.destructive }]}>Eliminar empleado</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function AddEmployeeModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { colors } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setDisplayName('');
    setUsername('');
    setPassword('');
    setConfirm('');
    setPin('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    setError(null);
    if (!displayName.trim() || !username.trim() || !password) {
      setError('Completa nombre, usuario y contraseña');
      return;
    }
    if (password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (pin && !/^\d{4,6}$/.test(pin)) {
      setError('El PIN debe tener entre 4 y 6 dígitos');
      return;
    }
    setLoading(true);
    try {
      await authService.registerUser(username, displayName, password, pin || undefined, false);
      onCreated();
      handleClose();
    } catch (e: any) {
      setError(e.message?.includes('UNIQUE') ? 'Ese usuario ya existe' : e.message ?? 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.borderLine }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Nuevo empleado</Text>
            <View style={{ gap: 10, marginTop: 14 }}>
              <TextField label="Nombre completo" value={displayName} onChangeText={setDisplayName} placeholder="Juan Pérez" />
              <TextField
                label="Usuario"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
                placeholder="jperez"
              />
              <TextField label="Contraseña" secureTextEntry value={password} onChangeText={setPassword} />
              <TextField label="Confirmar contraseña" secureTextEntry value={confirm} onChangeText={setConfirm} />
              <TextField
                label="PIN rápido (opcional, 4-6 dígitos)"
                keyboardType="number-pad"
                maxLength={6}
                value={pin}
                onChangeText={setPin}
              />
            </View>
            {error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
            <GradientButton
              label={loading ? 'Creando…' : 'Crear empleado'}
              onPress={handleCreate}
              loading={loading}
              style={{ marginTop: 14, marginBottom: 24 }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#10B98122', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#10B981', fontWeight: '900' },
  name: { fontSize: 14, fontWeight: '800' },
  username: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 20, paddingBottom: 30, maxHeight: '85%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#9CA3AF44', alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  sheetSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  error: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: 8 },
  secondaryText: { fontSize: 13, fontWeight: '700' },
});
