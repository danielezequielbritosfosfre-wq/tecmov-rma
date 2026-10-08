# TECMOV RMA 0.2 — versión de desarrollo

Sistema local de escritorio para gestión de garantías y reclamos. Basado en Electron y SQLite. Incluye el logo aportado por TECMOV.

## Ejecución en Windows
1. Descomprimir el ZIP.
2. Instalar Node.js 22.13 o posterior desde https://nodejs.org/.
3. Ejecutar `ABRIR-APP-WINDOWS.cmd` para usar la app, o `CREAR-INSTALADOR-WINDOWS.cmd` para compilar un instalador de Windows.
4. La primera vez se descargan dependencias. Requiere Internet para esta instalación inicial.

## Módulos actuales
- Panel principal, ingreso y consulta de expedientes RMA.
- Datos de factura, cliente, equipo, marca, SKU, serie, reclamo y condición al recibir.
- Evaluación, pruebas, diagnóstico, decisión documentada y línea temporal de estados.
- Impresión A4 de dos mitades, PDF y textos editables de WhatsApp.
- Registro de comunicaciones y fotos/documentos anexos.
- Catálogos persistentes de clientes, productos y proveedores.
- Acta de entrega con validación de identidad, registro de operador y conservación del historial.
- Reportes por estado/marca/mes, exportación CSV y auditoría de catálogos/entregas.
- Configuración comercial, exportación SQLite, respaldo integral verificable de base y adjuntos.
- Respaldo automático **al iniciar** (máximo uno por día, guarda los 14 más recientes) en la carpeta `automatic-backups` dentro del directorio de datos de Electron. No sustituye el respaldo externo ni protege ante pérdida completa de la PC.

## Protección de datos
SQLite usa transacciones, integridad de claves foráneas, WAL y `synchronous=FULL`. Los respaldos integrales `.rma-backup` contienen la base y todos los adjuntos y se validan con SHA-256. Un respaldo local no equivale a un respaldo externo. Se recomienda generar y verificar un respaldo integral al finalizar la jornada y copiarlo a un disco externo protegido.

## IMPORTANTE: limitaciones de esta versión
**Es una versión de desarrollo, no un producto validado para producción.** No se ha ejecutado ni probado en Windows, y todavía no se ha generado un `.exe` desde este entorno.
- No tiene todavía **restauración asistida**: verificación sí; la restauración debe efectuarse con la app cerrada por un técnico, recuperando `rma.sqlite` y `attachments` desde el `.rma-backup`.
- No cuenta aún con autenticación, perfiles, cifrado ni trazabilidad completa de modificaciones de todos los campos. No usar en PC compartida ni incorporar información sensible real sin esas medidas.
- El comprobante A4 requiere pruebas de impresión y puede truncar observaciones largas; no incluye anexos de varias páginas.
- Los catálogos están separados y no se vinculan automáticamente al alta del RMA; el expediente sí conserva sus propios datos.
- No hay evaluación legal automática ni conexión a ARCA, fabricantes o envíos reales de WhatsApp.
- El respaldo al inicio se genera en segundo plano; no garantiza recuperar cambios hechos después del último respaldo frente a una falla de disco. Generar copia manual al finalizar cada jornada.
- Falta control de vencimientos, derivaciones a proveedores y políticas de conservación de datos completas.

## Pruebas
Ejecutar `npm test` usando Node.js compatible. Las pruebas cubren persistencia, numeración, rechazo fundamentado, catálogos, entrega, reporte y comprobación de respaldo.


## Error `Cannot read properties of undefined (reading create)`

Este error ocurre si se abre `src/index.html` en un navegador (o si falla el preload de Electron). El guardado requiere el puente Electron `window.rma`. Abrí `ABRIR-APP-WINDOWS.cmd` o instalá la app. La versión 0.2.1 detecta ausencia del puente y bloquea el guardado para evitar creer que la información se almacenó. No borres los datos locales de la versión anterior.
