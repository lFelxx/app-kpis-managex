import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Animated, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult, CameraMountError } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { brand, radius, status } from '../theme/tokens';
import { scanItem, getItems, updateItem, deleteItem, closeArqueo, getArqueo } from '../services/arqueos';
import { ArqueoItem } from '../types';
import { ItemRow } from '../components/ItemRow';
import { CommentSheet } from '../components/CommentSheet';
import { GradientButton } from '../components/GradientButton';
import { TextField } from '../components/TextField';
import { RootStackParamList } from '../navigation/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

const RESCAN_COOLDOWN_MS = 1200;

export function ScannerScreen({ route, navigation }: Props) {
  const { arqueoId } = route.params;
  const { colors, mode } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [permission, requestPermission] = useCameraPermissions();
  const [items, setItems] = useState<ArqueoItem[]>([]);
  const [arqueoNombre, setArqueoNombre] = useState('');
  const [selected, setSelected] = useState<ArqueoItem | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const flashAnim = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState<string>(brand.emerald);
  const lastScan = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const [paused, setPaused] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [search, setSearch] = useState('');
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successSound = useAudioPlayer(require('../../assets/sounds/beep-success.wav'));
  const errorSound = useAudioPlayer(require('../../assets/sounds/beep-error.wav'));

  const load = useCallback(async () => {
    const data = await getItems(arqueoId);
    setItems(data);
    const arqueo = await getArqueo(arqueoId);
    if (arqueo) setArqueoNombre(arqueo.nombre);
  }, [arqueoId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
  }, []);

  const playBeep = (player: typeof successSound) => {
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Si el dispositivo no puede reproducir sonido, no bloqueamos el escaneo por eso.
    }
  };

  useEffect(() => {
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);

  const flash = (color: string = brand.emerald) => {
    setFlashColor(color);
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start();
  };

  const showScanError = (message: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    playBeep(errorSound);
    flash(status.error);
    setScanError(message);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setScanError(null), 3000);
  };

  const handleScan = useCallback(
    async (result: BarcodeScanningResult) => {
      const code = result.data?.trim();
      const now = Date.now();

      // Lectura vacía o basura: la cámara detectó "algo" pero no un código válido.
      if (!code) {
        showScanError('No se pudo leer ese código. Intenta de nuevo.');
        return;
      }
      if (lastScan.current.code === code && now - lastScan.current.at < RESCAN_COOLDOWN_MS) return;
      lastScan.current = { code, at: now };

      try {
        const item = await scanItem(arqueoId, code, user?.displayName ?? 'desconocido');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        playBeep(successSound);
        flash();
        setItems((prev) => {
          const idx = prev.findIndex((i) => i.id === item.id);
          if (idx === -1) return [item, ...prev];
          const copy = [...prev];
          copy[idx] = item;
          return copy;
        });
      } catch (e) {
        // Fallo real guardando en la base local (no un "no leyó nada").
        lastScan.current = { code: '', at: 0 };
        showScanError('No se pudo guardar ese código. Vuelve a escanearlo.');
      }
    },
    [arqueoId, user]
  );

  const totalUnidades = items.reduce((s, i) => s + i.cantidad, 0);
  const filteredItems = search.trim()
    ? items.filter(
        (i) =>
          i.codigo.toLowerCase().includes(search.trim().toLowerCase()) ||
          i.comentario?.toLowerCase().includes(search.trim().toLowerCase())
      )
    : items;

  const handleSaveItem = async (data: { comentario: string; cantidad: number }) => {
    if (!selected) return;
    await updateItem(
      selected,
      { comentario: data.comentario || null, cantidad: data.cantidad },
      user?.displayName ?? 'desconocido'
    );
    setItems((prev) =>
      prev.map((i) =>
        i.id === selected.id ? { ...i, comentario: data.comentario || null, cantidad: data.cantidad } : i
      )
    );
    setSelected(null);
    setPaused(false);
  };

  const handleDeleteItem = async () => {
    if (!selected) return;
    await deleteItem(selected, user?.displayName ?? 'desconocido');
    setItems((prev) => prev.filter((i) => i.id !== selected.id));
    setSelected(null);
    setPaused(false);
  };

  const handleManualAdd = async () => {
    const code = manualCode.trim();
    if (!code) return;
    try {
      const item = await scanItem(arqueoId, code, user?.displayName ?? 'desconocido');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      playBeep(successSound);
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.id === item.id);
        if (idx === -1) return [item, ...prev];
        const copy = [...prev];
        copy[idx] = item;
        return copy;
      });
      setManualCode('');
      setManualOpen(false);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBeep(errorSound);
      Alert.alert('No se pudo guardar', 'Hubo un problema guardando el código. Inténtalo de nuevo.');
    }
  };

  const handleFinish = async () => {
    await closeArqueo(arqueoId, user?.displayName ?? 'desconocido');
    navigation.replace('ArqueoDetail', { arqueoId });
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.permWrap, { backgroundColor: colors.background }]}>
        <Feather name="camera-off" size={40} color={colors.textMuted} />
        <Text style={[styles.permText, { color: colors.textPrimary }]}>
          Necesitamos acceso a la cámara para escanear los códigos de barras.
        </Text>
        <GradientButton label="Permitir cámara" onPress={requestPermission} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={styles.cameraWrap}>
        {!paused && !cameraError && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torchOn}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code93', 'code128', 'qr', 'itf14'],
            }}
            onBarcodeScanned={handleScan}
            onMountError={(e: CameraMountError) => setCameraError(e.message || 'No se pudo iniciar la cámara.')}
          />
        )}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.flashOverlay, { backgroundColor: flashColor, opacity: flashAnim }]}
        />

        {cameraError && (
          <View style={styles.cameraErrorWrap}>
            <Feather name="alert-triangle" size={28} color={status.error} />
            <Text style={styles.cameraErrorText}>{cameraError}</Text>
            <Pressable
              onPress={() => setCameraError(null)}
              style={[styles.smallRetryBtn, { borderColor: '#ffffff44' }]}
            >
              <Feather name="rotate-ccw" size={14} color="#fff" />
              <Text style={styles.smallRetryText}>Reintentar</Text>
            </Pressable>
          </View>
        )}

        {scanError && (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={14} color="#fff" />
            <Text style={styles.errorBannerText}>{scanError}</Text>
          </View>
        )}

        <SafeAreaView style={styles.topBar} edges={['top']}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Feather name="chevron-left" size={22} color="#fff" />
          </Pressable>
          <View style={styles.topBadge}>
            <Text style={styles.topBadgeText} numberOfLines={1}>
              {arqueoNombre}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setTorchOn((t) => !t)}
              style={[styles.iconBtn, torchOn && { backgroundColor: `${brand.emerald}CC` }]}
            >
              <Feather name={torchOn ? 'zap' : 'zap-off'} size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={() => setManualOpen(true)} style={styles.iconBtn}>
              <Feather name="edit-3" size={20} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>

        {!cameraError && <View style={styles.scanFrame} pointerEvents="none" />}
      </View>

      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.summaryRow}>
          <View>
            <Text style={[styles.summaryLabel, { color: colors.textMicro }]}>ÍTEMS ESCANEADOS</Text>
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
              {items.length} <Text style={styles.summarySub}>({totalUnidades} u.)</Text>
            </Text>
          </View>
          <GradientButton label="Finalizar arqueo" onPress={handleFinish} disabled={items.length === 0} />
        </View>

        {items.length > 3 && (
          <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
            <TextField
              placeholder="Buscar código o comentario…"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
          </View>
        )}

        <FlatList
          data={filteredItems}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 }}
          renderItem={({ item }) => (
            <ItemRow
              item={item}
              onPress={() => {
                setPaused(true);
                setSelected(item);
              }}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              {items.length === 0
                ? 'Apunta la cámara a un código de barras para empezar.'
                : 'Ningún código coincide con la búsqueda.'}
            </Text>
          }
        />
      </View>

      <CommentSheet
        visible={!!selected}
        codigo={selected?.codigo ?? ''}
        cantidad={selected?.cantidad ?? 0}
        initialComment={selected?.comentario}
        onClose={() => {
          setSelected(null);
          setPaused(false);
        }}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />

      <Modal visible={manualOpen} animationType="fade" transparent onRequestClose={() => setManualOpen(false)}>
        <View style={styles.manualOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setManualOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={[styles.manualCard, { backgroundColor: colors.card, borderColor: colors.borderLine }]}>
              <Text style={[styles.manualTitle, { color: colors.textPrimary }]}>Ingresar código manualmente</Text>
              <Text style={[styles.manualSubtitle, { color: colors.textMuted }]}>
                Útil cuando la etiqueta está dañada o ilegible
              </Text>
              <TextField
                placeholder="Código de barras"
                value={manualCode}
                onChangeText={setManualCode}
                autoFocus
                keyboardType="numbers-and-punctuation"
                style={{ marginTop: 14 }}
              />
              <GradientButton label="Agregar" onPress={handleManualAdd} disabled={!manualCode.trim()} style={{ marginTop: 8 }} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraWrap: { height: '46%', overflow: 'hidden', backgroundColor: '#000' },
  flashOverlay: { opacity: 0 },
  cameraErrorWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 30,
  },
  cameraErrorText: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  smallRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  smallRetryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  errorBanner: {
    position: 'absolute',
    top: 60,
    left: 14,
    right: 14,
    backgroundColor: '#DC2626EE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorBannerText: { color: '#fff', fontWeight: '700', fontSize: 12, flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBadge: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: '55%',
  },
  topBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  scanFrame: {
    position: 'absolute',
    top: '30%',
    left: '12%',
    right: '12%',
    height: '30%',
    borderWidth: 2,
    borderColor: brand.emerald,
    borderRadius: radius.md,
  },
  sheet: { flex: 1, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, marginTop: -20 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#9CA3AF44', alignSelf: 'center', marginTop: 10 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  summaryLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  summaryValue: { fontSize: 22, fontWeight: '900', marginTop: 4 },
  summarySub: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  emptyHint: { textAlign: 'center', marginTop: 30, fontSize: 13, fontWeight: '600' },
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  permText: { textAlign: 'center', fontSize: 14, fontWeight: '700' },
  manualOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 },
  manualCard: { width: '100%', maxWidth: 380, borderRadius: radius.lg, borderWidth: 1, padding: 20 },
  manualTitle: { fontSize: 16, fontWeight: '900' },
  manualSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
