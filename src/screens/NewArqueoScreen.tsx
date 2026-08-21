import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenBackground } from '../components/ScreenBackground';
import { Card } from '../components/Card';
import { TextField } from '../components/TextField';
import { GradientButton } from '../components/GradientButton';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { createArqueo } from '../services/arqueos';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NewArqueo'>;

export function NewArqueoScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [nombre, setNombre] = useState('');
  const [zona, setZona] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!nombre.trim() || !user) return;
    setLoading(true);
    try {
      const arqueo = await createArqueo(nombre, zona.trim() || null, user.displayName);
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
});
