import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenBackground } from '../components/ScreenBackground';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { TextField } from '../components/TextField';
import { GradientButton } from '../components/GradientButton';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { createArqueo } from '../services/arqueos';
import { ArqueoModo } from '../types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NewArqueo'>;

export function NewArqueoScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [nombre, setNombre] = useState('');
  const [zona, setZona] = useState('');
  const [modo, setModo] = useState<ArqueoModo>('simple');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!nombre.trim() || !user) return;
    setLoading(true);
    try {
      const arqueo = await createArqueo(nombre, zona.trim() || null, user.displayName, modo);
      navigation.replace('Scanner', { arqueoId: arqueo.id });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <View style={styles.headerRow}>
        <Feather name="arrow-left" size={22} color={colors.textPrimary} onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Nuevo arqueo</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.body}>
        <Card style={{ padding: 22, gap: 16 }}>
          <TextField
            label="Nombre del arqueo"
            placeholder='Ej: "Bodega principal" o "Conteo semanal"'
            value={nombre}
            onChangeText={setNombre}
            autoFocus
          />
          <TextField
            label="Zona / ubicación (opcional)"
            placeholder="Ej: Pasillo 3, Góndola de lácteos…"
            value={zona}
            onChangeText={setZona}
          />

          <View>
            <Text style={[styles.modoLabel, { color: colors.textSecondary }]}>Modo de escaneo</Text>

            <Pressable
              onPress={() => setModo('simple')}
              style={[
                styles.modoCard,
                { borderColor: modo === 'simple' ? '#10B981' : colors.borderLine, backgroundColor: colors.subtle },
              ]}
            >
              <View style={styles.modoHeader}>
                <Feather name="hash" size={16} color={colors.textPrimary} />
                <Text style={[styles.modoTitle, { color: colors.textPrimary }]}>Simple</Text>
                {modo === 'simple' && <Feather name="check-circle" size={16} color="#10B981" />}
              </View>
              <Text style={[styles.modoDesc, { color: colors.textMuted }]}>
                Cuenta por código de barras (UPC) tal cual, una fila por código escaneado. El de siempre.
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setModo('style_beta')}
              style={[
                styles.modoCard,
                { borderColor: modo === 'style_beta' ? '#10B981' : colors.borderLine, backgroundColor: colors.subtle },
              ]}
            >
              <View style={styles.modoHeader}>
                <Feather name="git-merge" size={16} color={colors.textPrimary} />
                <Text style={[styles.modoTitle, { color: colors.textPrimary }]}>Style Number</Text>
                <Badge label="Beta" tone="warning" />
                {modo === 'style_beta' && <Feather name="check-circle" size={16} color="#10B981" />}
              </View>
              <Text style={[styles.modoDesc, { color: colors.textMuted }]}>
                Al escanear, toma una foto de la etiqueta y lee el Style Number impreso (ej. "313313 01"), y unifica
                todas las tallas del mismo modelo/colorway en un solo ítem. Necesita internet la primera vez que ve
                cada modelo nuevo; si no logra leerlo, te deja ingresarlo a mano.
              </Text>
            </Pressable>
          </View>

          <GradientButton
            label={loading ? 'Creando…' : 'Empezar a escanear'}
            icon={<Feather name="camera" size={18} color="#fff" />}
            onPress={handleCreate}
            disabled={!nombre.trim()}
            loading={loading}
            style={{ marginTop: 6 }}
          />
        </Card>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  body: { padding: 20, marginTop: 16 },
  modoLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  modoCard: { borderWidth: 1.5, borderRadius: 16, padding: 14, marginBottom: 10 },
  modoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  modoTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  modoDesc: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
});
