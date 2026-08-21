# KPIManageX · Arqueos

App de inventario/arqueos con escaneo de código de barras por cámara, construida con **Expo (React Native)** siguiendo la línea visual de `kpis-management`.

## Stack

- Expo SDK 54 + TypeScript (compatible con el Expo Go actual de App Store/Play Store)
- `expo-camera` para escaneo rápido de códigos de barras (EAN-13/8, UPC, Code128/39/93, QR, ITF-14)
- `expo-sqlite` como base de datos local (usuarios, arqueos, ítems, auditoría)
- `expo-file-system` + `xlsx` (SheetJS) para exportar a **TXT / CSV / XLSX**
- `expo-sharing` (compartir) y `expo-mail-composer` (enviar por correo con adjunto)
- `expo-secure-store` + `expo-crypto` para login local con contraseña hasheada (SHA-256)
- Zustand para estado global, NativeWind instalado para utilidades Tailwind (los componentes base usan `StyleSheet` + tokens de tema para fidelidad visual exacta con kpis-management)

## Cómo correr en desarrollo (gratis, sin Mac, sin cuenta Apple)

```bash
npm install
npx expo start
```

Escanea el QR con la app **Expo Go** (gratis en App Store / Play Store). Todo funciona ahí, incluida la cámara.

## Funcionalidades implementadas

- **Login local multiusuario**: cada empleado tiene su cuenta (usuario + contraseña) y opcionalmente un **PIN rápido** para cambios de turno sin reescribir la contraseña.
- **Cuenta admin por defecto**: se crea automáticamente en cada dispositivo (`usuario: admin`, `contraseña: Adminkpi`) — cámbiala desde ahí si quieres. Solo el admin puede **eliminar arqueos** (mantén presionado un arqueo en Home, o el botón "Eliminar arqueo" en su detalle) — pensado para borrar arqueos fallidos o mal creados sin que el personal normal pueda borrar datos por accidente.
- **Bloqueo automático**: si la app pasa más de 3 minutos en segundo plano, pide PIN/contraseña de nuevo (`App.tsx`, `AUTO_LOCK_MS`).
- **Arqueos (sesiones de inventario)**: cada conteo agrupa ítems con fecha de creación/cierre, responsable y zona opcional.
- **Escaneo rápido continuo**: la cámara queda activa todo el tiempo; escanear el mismo código varias veces solo incrementa la cantidad (con cooldown de 1.2s para evitar duplicados accidentales). Incluye vibración + flash verde de confirmación.
- **Comentarios por ítem y por arqueo**: chips rápidos ("Faltante", "Dañado", "Vencido", etc.) + texto libre tipo "Hecho por Juan" o "Faltó revisar góndola 3".
- **Editar cantidad o quitar un código mientras se escanea**: al tocar un ítem en la lista en vivo se puede ajustar la cantidad (por si se escaneó de más) o eliminarlo del arqueo (con confirmación) — sin necesidad de terminar el arqueo primero.
- **Entrada manual**: para códigos dañados o ilegibles.
- **Cierre e inmutabilidad**: al cerrar un arqueo se calcula un checksum de los ítems. Si alguien edita algo después de cerrado, la app lo detecta (`wasModifiedAfterClose`) y muestra un badge "Modificado tras cierre", además de registrar el cambio en una **bitácora de auditoría** (quién, cuándo, valor anterior → nuevo).
- **Exportación en 3 formatos** (TXT, CSV, XLSX) con checksum de integridad incluido en el archivo, más botones para **compartir** (menú nativo) o **enviar directo por correo** (adjunto listo).
- **Exportación "Sistema POS"**: variante `.txt` limpia (solo el código, una línea por unidad, sin cantidad ni comentarios) para subir directo a sistemas que solo aceptan el listado plano.
- **Sonido de escaneo**: beep agudo al escanear/agregar con éxito, y un sonido grave distinto cuando hay un error real al guardar. Generados sintéticamente (`assets/sounds/`), sin audio de terceros.
- **Renombrar arqueo**: el nombre se puede editar desde el detalle (ícono de lápiz junto al título); el cambio siempre queda en la bitácora de auditoría, esté abierto o cerrado el arqueo.
- **Auditoría del cierre**: cerrar un arqueo también genera una entrada en la bitácora (quién y cuándo lo cerró), además del checksum de integridad.
- **Linterna en el escáner**: botón para prender/apagar el flash de la cámara mientras se escanea (útil en bodegas oscuras).
- **Buscar dentro de un arqueo**: campo de búsqueda por código o comentario, tanto en la lista en vivo del escáner como en el detalle del arqueo (aparece cuando hay más de 3 ítems).
- **Administración de empleados** (solo admin, `Ajustes → Administrar empleados`): ver todos los usuarios del dispositivo, crear nuevos empleados sin salir de la sesión actual, restablecer la contraseña de cualquiera (incluida la del propio admin), quitar el PIN de un usuario, y eliminar cuentas de empleados (no de admins).

## Distribución en iPhone sin Mac

- **Gratis**: Expo Go (arriba). Sin ícono propio en el home screen, pero 100% funcional.
- **Con ícono propio / TestFlight**: requiere cuenta Apple Developer Program (USD 99/año, requisito de Apple, no técnico). Una vez la tengas:
  ```bash
  npm install -g eas-cli
  eas login
  eas build --platform ios --profile production
  eas submit --platform ios
  ```
  Todo compila en la nube de Expo (EAS Build), sin necesidad de Mac.

## Distribución en Android

```bash
eas build --platform android --profile preview
```

Genera un `.apk` instalable directamente en el celular (sideload), sin pasar por Play Store — ideal para uso interno en la tienda.

## Próximos pasos sugeridos

- **Manejo de errores de escaneo** (ya implementado): la cámara solo dispara evento cuando decodifica con éxito, así que no existe un "error de lectura" nativo para etiquetas dañadas/borrosas — eso se cubre con el botón de código manual. Sí se detectan y muestran errores reales: fallo al iniciar la cámara (`onMountError`), lectura vacía/corrupta, y fallo al guardar en la base local. Ver `src/screens/ScannerScreen.tsx`.

- **Restringir el escaneo al recuadro visual (mejora futura, anotada, no implementada)**: hoy el recuadro verde de la pantalla de escaneo es solo una guía visual — `expo-camera` no soporta limitar la detección a una región de la imagen, solo filtrar por tipo de código. Si hay más de un código de barras visible (ej. productos contiguos en un estante), puede leer el que no era. La librería sí expone `bounds`/`cornerPoints` en cada lectura, así que se podría filtrar por posición, pero esas coordenadas vienen en sistemas distintos en iOS vs Android y a veces vacías según el tipo de código — requeriría implementarlo y ajustarlo probando en dispositivo real. Mientras tanto, la mitigación es acercar el celular al código para que sea el único visible en el encuadre.

- **Sincronización multi-dispositivo (pendiente, app queda local por ahora)**: cuando se quiera ver todos los arqueos de varios celulares centralizados, en una sección "Arqueos" independiente del dashboard de KPIs (no mezclada con los KPIs actuales, tal como se acordó), el plan es:
  1. **Backend**: extender el Spring Boot de `kpis-management` con tablas `arqueos`/`arqueo_items` y endpoints autenticados para recibir lo escaneado desde cada celular, más un endpoint de lectura para la nueva sección.
  2. **Cliente de sync**: cada escaneo se sigue guardando local (como ahora) y además se envía al backend si hay conexión, con cola de reintento offline. El campo `synced` ya existe en el modelo `Arqueo` (`src/types/index.ts`) para esto — falta agregarlo también a `ArqueoItem` y escribir el servicio de sincronización.
  3. **Tiempo real en el visor**: empezar con polling cada pocos segundos desde quien consulta los arqueos (simple, ~2-5s de latencia); si más adelante se necesita latencia instantánea, agregar WebSocket/SSE en el backend (Spring lo soporta bien) sin rehacer el resto.
