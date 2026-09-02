import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Animated, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult, CameraMountError } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { brand, radius, status } from '../theme/tokens';
import {
  scanItem,
  scanItemByStyle,
  updateItem,
  updateItemResolution,
  deleteItem,
  closeArqueo,
  getArqueo,
  getItems,
  setItemStyleNumber,
} from '../services/arqueos';
import { resolveStyleNumber, getCachedStyleNumber, resolveWithoutCache } from '../services/styleResolver';
import { startResolution, finishResolution, usePendingResolutions } from '../services/resolutionQueue';
import { ArqueoItem, ArqueoModo } from '../types';
import { groupByStyle, groupToDisplayItem, StyleGroup } from '../utils/styleGroups';
import { ItemRow } from '../components/ItemRow';
import { CommentSheet } from '../components/CommentSheet';
import { StyleGroupSheet } from '../components/StyleGroupSheet';
import { GradientButton } from '../components/GradientButton';
import { TextField } from '../components/TextField';
import { RootStackParamList } from '../navigation/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

const RESCAN_COOLDOWN_MS = 1200;
/** Pausa antes de tomar la foto: expo-camera no expone un evento de "ya enfocó",
 * así que le damos este respiro breve al enfoque automático para que se asiente
 * antes de capturar. Se mantiene corta a propósito para no sacrificar fluidez —
 * solo se paga esta pausa la PRIMERA vez que se ve un código nuevo (con caché,
 * el escaneo es instantáneo, igual que en modo simple). */
const FOCUS_SETTLE_MS = 150;

export function ScannerScreen({ route, navigation }: Props) {
  const { arqueoId } = route.params;
  const { colors, mode } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [permission, requestPermission] = useCameraPermissions();
  const [items, setItems] = useState<ArqueoItem[]>([]);
  const [arqueoNombre, setArqueoNombre] = useState('');
  const [arqueoModo, setArqueoModo] = useState<ArqueoModo>('simple');
  const [focusing, setFocusing] = useState(false);
  const [selected, setSelected] = useState<ArqueoItem | null>(null);
  const [groupSheet, setGroupSheet] = useState<StyleGroup | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const flashAnim = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState<string>(brand.emerald);
  const lastScan = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const cameraRef = useRef<CameraView>(null);
  const processingRef = useRef(false);
  const resolvingUpcsRef = useRef<Set<string>>(new Set());
  const [confirmQueue, setConfirmQueue] = useState<{ itemId: number; styleNumber: string }[]>([]);
  const pendingResolutions = usePendingResolutions(arqueoId);
  const [retryTarget, setRetryTarget] = useState<ArqueoItem | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);
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
    if (arqueo) {
      setArqueoNombre(arqueo.nombre);
      setArqueoModo(arqueo.modo);
    }
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

  /** Toma una foto del cuadro completo (no solo el recuadro guía) y la
   * redimensiona/comprime para que quepa en el límite gratis de OCR.space.
   * Sin `skipProcessing` (para no perder orientación ni saltarse el enfoque
   * final de la captura) y sin sonido de obturador. */
  const capturePhotoForOcr = async (): Promise<string | undefined> => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9, shutterSound: false });
      if (!photo?.uri) return undefined;
      const manipulated = await ImageManipulator.manipulateAsync(photo.uri, [{ resize: { width: 1200 } }], {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      return manipulated.base64 ?? undefined;
    } catch (e) {
      console.log('[StyleResolver] No se pudo tomar/comprimir la foto para OCR:', e);
      return undefined;
    }
  };

  const showScanError = (message: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    playBeep(errorSound);
    flash(status.error);
    setScanError(message);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setScanError(null), 3000);
  };

  const finalizeScanSuccess = useCallback((item: ArqueoItem, haptic = Haptics.ImpactFeedbackStyle.Medium) => {
    Haptics.impactAsync(haptic);
    playBeep(successSound);
    flash();
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx === -1) return [item, ...prev];
      const copy = [...prev];
      copy[idx] = item;
      return copy;
    });
  }, []);

  /** Resuelve en SEGUNDO PLANO (no bloquea seguir escaneando el siguiente
   * código) — la foto ya se tomó antes de soltar el bloqueo, así que sigue
   * siendo la foto correcta de esta etiqueta aunque el celular ya se haya
   * movido al siguiente producto para cuando esto termine. */
  const resolveInBackground = useCallback(
    (itemId: number, code: string, photoBase64: string | undefined) => {
      startResolution(arqueoId, itemId);
      resolveWithoutCache(code, photoBase64)
        .then((resolved) =>
          updateItemResolution(itemId, resolved, user?.displayName ?? 'desconocido').then(() => resolved)
        )
        .then((resolved) => {
          load();
          if (resolved.styleNumber && resolved.isNewStyle) {
            setConfirmQueue((q) => [...q, { itemId, styleNumber: resolved.styleNumber! }]);
          }
        })
        .catch((e) => console.log('[StyleResolver] Resolución en segundo plano falló:', e))
        .finally(() => {
          resolvingUpcsRef.current.delete(code);
          finishResolution(arqueoId, itemId);
        });
    },
    [arqueoId, user, load]
  );

  /** Vuelve a intentar OCR para un ítem que quedó "sin resolver" — abre la
   * cámara enfocada solo en tomar una foto nueva, sin re-escanear el código
   * de barras (ya se conoce el UPC del ítem). */
  const handleRetryPhoto = useCallback((item: ArqueoItem) => {
    setSelected(null);
    setPaused(false);
    setRetryTarget(item);
  }, []);

  const captureRetryPhoto = useCallback(async () => {
    if (!retryTarget) return;
    setRetryBusy(true);
    try {
      const photoBase64 = await capturePhotoForOcr();
      resolveInBackground(retryTarget.id, retryTarget.codigo, photoBase64);
    } finally {
      setRetryBusy(false);
      setRetryTarget(null);
    }
  }, [retryTarget, resolveInBackground]);

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
      if (processingRef.current) return; // ya hay un escaneo en la parte rápida (tomando foto)
      lastScan.current = { code, at: now };
      processingRef.current = true;

      try {
        if (arqueoModo === 'style_beta') {
          // Escaneo repetido de un modelo ya visto: instantáneo, sin foto ni espera.
          const cached = await getCachedStyleNumber(code);
          if (cached) {
            const item = await scanItemByStyle(arqueoId, code, cached, user?.displayName ?? 'desconocido');
            finalizeScanSuccess(item);
            return;
          }
          // Modelo nuevo, pero ya hay una resolución en curso para este mismo
          // código (se escaneó otra unidad antes de que la primera terminara):
          // solo sumamos cantidad, sin repetir foto ni gastar otra llamada de OCR/API.
          if (resolvingUpcsRef.current.has(code)) {
            const item = await scanItemByStyle(
              arqueoId,
              code,
              { styleNumber: null, brand: null, title: null, source: 'none' },
              user?.displayName ?? 'desconocido'
            );
            finalizeScanSuccess(item);
            return;
          }
          // Modelo nuevo: solo se espera lo rápido (enfoque + foto). La
          // resolución (OCR/API) corre después, sin bloquear el siguiente escaneo.
          resolvingUpcsRef.current.add(code);
          setFocusing(true);
          await new Promise((r) => setTimeout(r, FOCUS_SETTLE_MS));
          const photoBase64 = await capturePhotoForOcr();
          setFocusing(false);
          const item = await scanItemByStyle(
            arqueoId,
            code,
            { styleNumber: null, brand: null, title: null, source: 'none' },
            user?.displayName ?? 'desconocido'
          );
          finalizeScanSuccess(item);
          resolveInBackground(item.id, code, photoBase64);
        } else {
          const item = await scanItem(arqueoId, code, user?.displayName ?? 'desconocido');
          finalizeScanSuccess(item);
        }
      } catch (e) {
        // Fallo real guardando en la base local (no un "no leyó nada").
        resolvingUpcsRef.current.delete(code);
        setFocusing(false);
        lastScan.current = { code: '', at: 0 };
        showScanError('No se pudo guardar ese código. Vuelve a escanearlo.');
      } finally {
        processingRef.current = false;
      }
    },
    [arqueoId, user, arqueoModo, finalizeScanSuccess, resolveInBackground]
  );

  const totalUnidades = items.reduce((s, i) => s + i.cantidad, 0);
  const filteredItems = search.trim()
    ? items.filter(
        (i) =>
          i.codigo.toLowerCase().includes(search.trim().toLowerCase()) ||
          i.styleNumber?.toLowerCase().includes(search.trim().toLowerCase()) ||
          i.comentario?.toLowerCase().includes(search.trim().toLowerCase())
      )
    : items;

  const groups = arqueoModo === 'style_beta' ? groupByStyle(filteredItems) : [];

  const handleRowPress = (group: StyleGroup) => {
    setPaused(true);
    if (group.items.length > 1) {
      setGroupSheet(group);
    } else {
      setSelected(group.items[0]);
    }
  };

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

  const handleSetStyleNumber = async (value: string) => {
    if (!selected) return;
    await setItemStyleNumber(selected, value, user?.displayName ?? 'desconocido');
    setSelected(null);
    setPaused(false);
    load();
  };

  const handleManualAdd = async () => {
    const code = manualCode.trim();
    if (!code) return;
    try {
      let item: ArqueoItem;
      if (arqueoModo === 'style_beta') {
        const resolved = await resolveStyleNumber(code);
        item = await scanItemByStyle(arqueoId, code, resolved, user?.displayName ?? 'desconocido');
      } else {
        item = await scanItem(arqueoId, code, user?.displayName ?? 'desconocido');
      }
      finalizeScanSuccess(item, Haptics.ImpactFeedbackStyle.Light);
      setManualCode('');
      setManualOpen(false);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBeep(errorSound);
      Alert.alert('No se pudo guardar', 'Hubo un problema guardando el código. Inténtalo de nuevo.');
    }
  };

  const handleFinish = async () => {
    if (pendingResolutions > 0) {
      Alert.alert(
        'Resoluciones en curso',
        `Todavía hay ${pendingResolutions} código${pendingResolutions === 1 ? '' : 's'} identificándose en segundo plano. Si cierras ahora, puede que queden marcados "sin resolver" — podrás corregirlos a mano después.`,
        [
          { text: 'Esperar', style: 'cancel' },
          {
            text: 'Cerrar de todas formas',
            style: 'destructive',
            onPress: async () => {
              await closeArqueo(arqueoId, user?.displayName ?? 'desconocido');
              navigation.replace('ArqueoDetail', { arqueoId });
            },
          },
        ]
      );
      return;
    }
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
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torchOn}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code93', 'code128', 'qr', 'itf14'],
            }}
            onBarcodeScanned={retryTarget ? undefined : handleScan}
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

        {focusing && (
          <View style={styles.resolvingBanner}>
            <Feather name="loader" size={14} color="#fff" />
            <Text style={styles.errorBannerText}>Enfocando…</Text>
          </View>
        )}

        {confirmQueue.length > 0 && (
          <View style={styles.confirmBanner}>
            <Feather name="tag" size={16} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.confirmBannerTitle}>Nuevo style number leído</Text>
              <Text style={styles.confirmBannerValue}>{confirmQueue[0].styleNumber}</Text>
            </View>
            <Pressable
              onPress={() => setConfirmQueue((q) => q.slice(1))}
              style={[styles.confirmBtn, { backgroundColor: `${brand.emerald}CC` }]}
            >
              <Feather name="check" size={16} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => {
                const pendingItem = confirmQueue[0];
                const item = items.find((i) => i.id === pendingItem.itemId);
                setConfirmQueue((q) => q.slice(1));
                if (item) {
                  setPaused(true);
                  setSelected(item);
                }
              }}
              style={[styles.confirmBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
            >
              <Feather name="edit-2" size={16} color="#fff" />
            </Pressable>
          </View>
        )}

        <SafeAreaView style={styles.topBar} edges={['top']}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Feather name="chevron-left" size={22} color="#fff" />
          </Pressable>
          <View style={styles.topBadge}>
            <Text style={styles.topBadgeText} numberOfLines={1}>
              {arqueoModo === 'style_beta' ? `⚡ ${arqueoNombre}` : arqueoNombre}
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

        {!cameraError && !retryTarget && <View style={styles.scanFrame} pointerEvents="none" />}

        {!cameraError && !focusing && !retryTarget && arqueoModo === 'style_beta' && (
          <View style={styles.focusHint} pointerEvents="none">
            <Feather name="crosshair" size={12} color="#fff" />
            <Text style={styles.focusHintText}>Mantén la etiqueta quieta y bien enfocada</Text>
          </View>
        )}

        {!cameraError && retryTarget && (
          <View style={styles.retryOverlay} pointerEvents="box-none">
            <View style={styles.retryTopHint}>
              <Text style={styles.retryTopHintText} numberOfLines={1}>
                Nueva foto para: {retryTarget.codigo}
              </Text>
            </View>
            <View style={styles.retryControls}>
              <Pressable
                onPress={() => setRetryTarget(null)}
                disabled={retryBusy}
                style={[styles.retryCancelBtn, { opacity: retryBusy ? 0.5 : 1 }]}
              >
                <Feather name="x" size={20} color="#fff" />
              </Pressable>
              <Pressable
                onPress={captureRetryPhoto}
                disabled={retryBusy}
                style={[styles.retryShutterBtn, { opacity: retryBusy ? 0.6 : 1 }]}
              >
                {retryBusy ? (
                  <Feather name="loader" size={26} color="#000" />
                ) : (
                  <Feather name="camera" size={26} color="#000" />
                )}
              </Pressable>
              <View style={{ width: 44 }} />
            </View>
          </View>
        )}
      </View>

      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.summaryRow}>
          <View>
            <Text style={[styles.summaryLabel, { color: colors.textMicro }]}>ÍTEMS ESCANEADOS</Text>
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
              {items.length} <Text style={styles.summarySub}>({totalUnidades} u.)</Text>
            </Text>
            {pendingResolutions > 0 && (
              <View style={styles.pendingPill}>
                <Feather name="loader" size={10} color={status.warning} />
                <Text style={[styles.pendingPillText, { color: status.warning }]}>
                  {pendingResolutions} resolviéndose
                </Text>
              </View>
            )}
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

        {arqueoModo === 'style_beta' ? (
          <FlatList
            data={groups}
            keyExtractor={(g) => g.key}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 }}
            renderItem={({ item: group }) => (
              <ItemRow item={groupToDisplayItem(group)} onPress={() => handleRowPress(group)} />
            )}
            ListEmptyComponent={
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                {items.length === 0
                  ? 'Apunta la cámara a un código de barras para empezar.'
                  : 'Ningún código coincide con la búsqueda.'}
              </Text>
            }
          />
        ) : (
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
        )}
      </View>

      <CommentSheet
        visible={!!selected}
        codigo={selected?.codigo ?? ''}
        cantidad={selected?.cantidad ?? 0}
        initialComment={selected?.comentario}
        detalle={selected?.detalle}
        styleNumber={selected?.styleNumber}
        resolutionSource={selected?.resolutionSource}
        onClose={() => {
          setSelected(null);
          setPaused(false);
        }}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        onSetStyleNumber={arqueoModo === 'style_beta' ? handleSetStyleNumber : undefined}
        onRetryPhoto={arqueoModo === 'style_beta' && selected ? () => handleRetryPhoto(selected) : undefined}
      />

      <StyleGroupSheet
        visible={!!groupSheet}
        group={groupSheet}
        onClose={() => {
          setGroupSheet(null);
          setPaused(false);
        }}
        onSelectItem={(item) => {
          setGroupSheet(null);
          setSelected(item);
        }}
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
  resolvingBanner: {
    position: 'absolute',
    top: 60,
    left: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmBanner: {
    position: 'absolute',
    top: 110,
    left: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  confirmBannerTitle: { color: '#9CA3AF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  confirmBannerValue: { color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 1 },
  confirmBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  pendingPillText: { fontSize: 10, fontWeight: '800' },
  retryOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  retryTopHint: {
    alignSelf: 'center',
    marginTop: 100,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryTopHintText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  retryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
  },
  retryCancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryShutterBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  focusHint: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 999,
    paddingVertical: 6,
  },
  focusHintText: { color: '#fff', fontSize: 11, fontWeight: '700' },
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
