import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenBackground } from '../components/ScreenBackground';
import { Card } from '../components/Card';
import { TextField } from '../components/TextField';
import { GradientButton } from '../components/GradientButton';
import { Logo } from '../components/Logo';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';

export function LockScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const loginWithPin = useAuthStore((s) => s.loginWithPin);
  const login = useAuthStore((s) => s.login);
  const unlock = useAuthStore((s) => s.unlock);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    setError(null);
    setLoading(true);
    try {
      if (/^\d{4,6}$/.test(value)) {
        await loginWithPin(value);
      } else if (user) {
        await login(user.username, value);
      }
      unlock();
    } catch (e: any) {
      setError('PIN o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <View style={styles.center}>
        <Logo size={48} />
        <Feather name="lock" size={22} color={colors.textMuted} style={{ marginTop: 20, marginBottom: 8 }} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Sesión bloqueada</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Hola {user?.displayName}, ingresa tu PIN o contraseña para continuar
        </Text>

        <Card style={styles.card} raised>
          <TextField
            placeholder="PIN o contraseña"
            secureTextEntry
            value={value}
            onChangeText={setValue}
            autoFocus
          />
          {error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
          <GradientButton
            label={loading ? 'Verificando…' : 'Desbloquear'}
            onPress={handleUnlock}
            loading={loading}
            style={{ marginTop: 14 }}
          />
        </Card>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center', maxWidth: 280 },
  card: { width: '100%', maxWidth: 380, padding: 20, marginTop: 26 },
  error: { fontSize: 12, fontWeight: '700', marginTop: 8 },
});
