import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenBackground } from '../components/ScreenBackground';
import { Card } from '../components/Card';
import { TextField } from '../components/TextField';
import { GradientButton } from '../components/GradientButton';
import { Logo } from '../components/Logo';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';

export function RegisterScreen({ onGoLogin, isFirstUser }: { onGoLogin: () => void; isFirstUser: boolean }) {
  const { colors } = useTheme();
  const register = useAuthStore((s) => s.register);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
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
      await register(username, displayName, password, pin || undefined);
    } catch (e: any) {
      setError(e.message?.includes('UNIQUE') ? 'Ese usuario ya existe' : e.message ?? 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Logo size={48} />
        </View>

        <Card style={styles.card} raised>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isFirstUser ? 'Configura tu tienda' : 'Nuevo empleado'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {isFirstUser
              ? 'Crea la cuenta principal para este dispositivo'
              : 'Agrega un usuario más para este dispositivo'}
          </Text>

          <View style={{ marginTop: 20, gap: 14 }}>
            <TextField label="Nombre completo" value={displayName} onChangeText={setDisplayName} placeholder="Juan Pérez" />
            <TextField
              label="Usuario"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              placeholder="jperez"
            />
            <TextField label="Contraseña" secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" />
            <TextField label="Confirmar contraseña" secureTextEntry value={confirm} onChangeText={setConfirm} placeholder="••••••••" />
            <TextField
              label="PIN rápido (opcional, 4-6 dígitos)"
              keyboardType="number-pad"
              maxLength={6}
              value={pin}
              onChangeText={setPin}
              placeholder="Para cambiar de turno sin escribir contraseña"
            />
          </View>

          {error && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          <GradientButton
            label={loading ? 'Creando…' : 'Crear cuenta'}
            onPress={handleRegister}
            loading={loading}
            style={{ marginTop: 22 }}
          />

          <Text onPress={onGoLogin} style={[styles.link, { color: colors.textMuted }]}>
            {isFirstUser ? (
              <>
                ¿Ya tienes cuenta? <Text style={{ color: '#10B981', fontWeight: '800' }}>Inicia sesión</Text>
              </>
            ) : (
              <>
                ¿Ibas a iniciar sesión? <Text style={{ color: '#10B981', fontWeight: '800' }}>Volver al login</Text>
              </>
            )}
          </Text>
        </Card>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoWrap: { marginBottom: 20 },
  card: { width: '100%', maxWidth: 400, padding: 24 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  errorText: { fontSize: 12, fontWeight: '700' },
  link: { textAlign: 'center', marginTop: 18, fontSize: 13, fontWeight: '600' },
});
