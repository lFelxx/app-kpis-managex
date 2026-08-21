import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenBackground } from '../components/ScreenBackground';
import { Card } from '../components/Card';
import { TextField } from '../components/TextField';
import { GradientButton } from '../components/GradientButton';
import { Logo } from '../components/Logo';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';

export function LoginScreen({ onGoRegister }: { onGoRegister: () => void }) {
  const { colors } = useTheme();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (!username.trim() || !password) {
      setError('Ingresa usuario y contraseña');
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
    } catch (e: any) {
      setError(e.message ?? 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Logo size={56} />
        </View>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>Control de arqueos e inventario</Text>

        <Card style={styles.card} raised>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Bienvenido de nuevo</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Inicia sesión para continuar con tus arqueos
          </Text>

          <View style={{ marginTop: 20, gap: 14 }}>
            <TextField
              label="Usuario"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              placeholder="ej. jperez"
            />
            <TextField
              label="Contraseña"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
            />
          </View>

          {error && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          <GradientButton
            label={loading ? 'Ingresando…' : 'Ingresar'}
            onPress={handleLogin}
            loading={loading}
            style={{ marginTop: 22 }}
          />

          <Text onPress={onGoRegister} style={[styles.registerLink, { color: colors.textMuted }]}>
            ¿Primera vez en este dispositivo? <Text style={{ color: '#10B981', fontWeight: '800' }}>Crear cuenta local</Text>
          </Text>
        </Card>

        <Text style={[styles.footer, { color: colors.textMicro }]}>KPIManageX · Arqueos · Uso local</Text>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoWrap: { marginBottom: 6 },
  tagline: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 28 },
  card: { width: '100%', maxWidth: 400, padding: 24 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  errorText: { fontSize: 12, fontWeight: '700' },
  registerLink: { textAlign: 'center', marginTop: 18, fontSize: 13, fontWeight: '600' },
  footer: { marginTop: 28, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
});
