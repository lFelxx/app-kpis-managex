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
- **Unificar varios arqueos en uno solo** (`src/services/arqueos.ts`, función `mergeArqueos`): en Home, el ícono de capas junto al avatar activa un modo de selección múltiple — se eligen varios arqueos **ya cerrados** (ej. uno por pasillo/sección) y se crea un arqueo nuevo, cerrado, con los códigos sumados (si el mismo UPC aparece en varios orígenes, las cantidades se combinan en una sola fila). Útil cuando se cuenta por secciones pero se necesita un solo total para el sistema POS. **Los arqueos originales no se tocan ni se borran** — la unificación crea una copia consolidada aparte, con una nota indicando de cuáles arqueos viene y quedando registrada en la bitácora de auditoría.

### Modo beta: resolución de Style Number (`src/services/styleResolver.ts`)

Al crear un arqueo se puede elegir entre **Simple** (de siempre, cuenta por UPC crudo) o **Style Number (beta)**: intenta resolver el style number real del producto a partir del UPC escaneado y **agrupa visualmente** todas las tallas de un mismo modelo/colorway en una sola fila.

**Importante sobre el diseño**: `arqueo_items.codigo` es **siempre** el UPC real escaneado, en los dos modos — igual que si fuera modo simple. El style number resuelto se guarda aparte, en su propia columna (`styleNumber`), nunca reemplaza el código de barras. La "unificación por talla" que ves en la lista es **solo una agrupación visual** al momento de mostrar los datos (`src/utils/styleGroups.ts`), no una transformación de lo guardado. Esto es a propósito: la primera versión de esto sí sobrescribía `codigo` con el style number, lo cual perdía el UPC real y hacía ambiguo qué talla ajustar al editar una cantidad — se corrigió por completo.

Al tocar una fila agrupada que representa más de una talla, se abre un desglose (`StyleGroupSheet`) mostrando cada código de barras real por separado, cada uno editable individualmente (cantidad, comentario, eliminar) sin ambigüedad.

Se probó con etiquetas reales de Puma: las bases de datos externas (UPCitemdb, Open Products Facts) no tenían ninguno de los productos probados — el UPC de Puma casi nunca está en bases de consumo genéricas. La solución que sí funciona con lo que hay disponible: **leer el style number directo de la etiqueta con OCR**, ya que Puma lo imprime como texto junto al código de barras (confirmado en fotos reales: formato `"313313 01"`, con espacio, no guion).

Cadena de resolución, sin scraping ni nada que viole términos de servicio de terceros:
1. **Caché local** (`product_cache` en SQLite) — instantáneo y gratis, se consulta primero.
2. **OCR de una foto del cuadro completo** (principal): al escanear, la app toma una foto de todo lo que ve la cámara — no solo cerca del código de barras — y la manda a **OCR.space** (API gratis, sin registro obligatorio, 25,000 lecturas/mes) para leer el texto. Luego busca el patrón `123456 01` / `123456-01` en **cualquier parte** del texto leído, así funciona aunque la referencia esté en otra parte de la etiqueta y no pegada al código. La foto se redimensiona/comprime con `expo-image-manipulator` antes de enviarla.
3. **UPCitemdb** (respaldo secundario, gratis, sin API key, 100 consultas/día) — solo por si el OCR falla y el producto sí está en su base.
4. **Manual**: si nada funcionó, la app te deja escribirlo en la ficha del ítem — queda guardado en caché para siempre.

**Importante sobre la llave de OCR.space**: el código usa por defecto la llave pública de demo (`helloworld`), que funciona sin registro pero es compartida por todo el mundo y puede fallar por uso ajeno. Para uso real en la tienda, regístrate gratis (sin tarjeta) en https://ocr.space/ocrapi y reemplaza `OCR_SPACE_API_KEY` en `src/services/styleResolver.ts` con tu propia llave — son 25,000 lecturas/mes gratis, deberían sobrar de sobra.

**Logs de diagnóstico**: cada resolución imprime en la terminal de `npx expo start` el detalle completo de cada fuente consultada (foto enviada, texto leído por OCR, respuesta de UPCitemdb) con el prefijo `[StyleResolver]` — útil para saber si el problema es que la foto salió borrosa/mal encuadrada, o que el texto no trae el patrón esperado.

**Ayudas para que salga bien a la primera** (`src/screens/ScannerScreen.tsx`):
- Hay un aviso fijo en pantalla en modo beta: "Mantén la etiqueta quieta y bien enfocada".
- Antes de tomar la foto, la app espera ~150ms (constante `FOCUS_SETTLE_MS`) para darle tiempo al enfoque automático de asentarse — `expo-camera` no tiene un evento de "ya enfocó" para esperar eso exactamente, esto es una aproximación, no una garantía de foto nítida. Se acortó de 500ms a 150ms para no sacrificar fluidez (ver siguiente punto).
- Sonido de obturador desactivado (`shutterSound: false`).
- Se quitó `skipProcessing` de la captura (estaba ignorando silenciosamente la calidad configurada y podía entregar la foto con orientación incorrecta, lo que probablemente afectaba la lectura del OCR).

**El escaneo NO espera a que termine el OCR**: la primera versión de esto bloqueaba el siguiente escaneo hasta que la foto viajara a OCR.space y volviera (1-3s), lo cual se sentía lento. Ahora, para un código nuevo: 1) se chequea la caché (instantáneo), 2) si no está, se toma la foto (rápido, ~300-800ms) y se guarda el ítem de inmediato con el UPC ya visible en la lista, 3) la resolución (OCR + respaldo UPCitemdb) corre **en segundo plano** sin bloquear el siguiente escaneo — cuando termina, actualiza esa fila sola. Escanear un código ya visto (caché) sigue siendo instantáneo, igual que en modo simple. El cooldown de 1.2s contra dobles-lecturas del mismo código (`RESCAN_COOLDOWN_MS`) sigue igual.

**Export "Sistema POS" siempre usa el UPC real, en ambos modos**: como `codigo` nunca deja de ser el UPC (ver arriba), el export POS (`generatePosExportFile` en `src/services/export.ts`) funciona exactamente igual sin importar el modo del arqueo — no necesita ninguna lógica especial ni tabla aparte. Editar la cantidad de una talla específica, o borrarla, ahora también es exacto y sin ambigüedad, porque cada talla es su propia fila real desde el principio.

**Tres opciones de exportación** (la pantalla de detalle de un arqueo beta muestra las tres, ninguna reemplaza a otra):
1. **Sistema POS** — sin cambios: `.txt` plano, solo UPCs, una línea por unidad.
2. **Formato para almacenar (por UPC)** — el de siempre, sin agrupar: una fila por código de barras/talla, con cantidad, comentarios, fechas.
3. **Formato para almacenar (por Style Number)** — nuevo (`generateExportFileByStyle` en `src/services/export.ts`), solo visible en arqueos modo beta: una fila por referencia, con el total de unidades sumando todas las tallas, y el detalle de qué UPCs aportaron a ese total, para tener el inventario real por referencia.

**Nota sobre arqueos beta creados antes de este arreglo**: si ya escaneaste algo en modo beta con la versión anterior de la app, esos ítems tienen el style number guardado en `codigo` (el UPC de esos escaneos específicos ya no se puede recuperar, se sobrescribió). Los escaneos nuevos, desde este arreglo en adelante, sí guardan todo correctamente.

**Honestidad sobre las limitaciones** (es beta, no una promesa):
- El OCR depende de que la etiqueta esté bien iluminada, enfocada y dentro del cuadro de la cámara al momento del escaneo — con mala luz o muy de lejos puede no leer nada.
- El patrón regex es una heurística basada en el formato real de Puma; otras marcas con formato distinto no van a coincidir.
- Cada foto+lectura toma 1-3 segundos (depende de la conexión); con la caché local, escaneos repetidos del mismo modelo son instantáneos.
- Se probó exitosamente que el pipeline de logs y las fuentes de respaldo funcionan correctamente; falta validar el OCR en sí con fotos reales de etiquetas en la tienda.
- **La solución ideal a futuro** sigue siendo conseguir acceso interno en Puma a la tabla real UPC → Style Number (PLM/SAP/sistema de producto) — sería 100% confiable, sin depender de fotos ni de que la etiqueta se vea bien.

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
