# TECMOV RMA PRO — Plan de lanzamiento comercial

## Estado real del desarrollo
**NO AUTORIZADO PARA COMERCIALIZACIÓN TODAVÍA.** La app conserva compatibilidad con instalaciones de desarrollo y no exige una licencia. El módulo `license.js` solo verifica licencias firmadas digitalmente: el servidor emisor, la activación, la revocación y la administración de usuarios no están implementados.

## Seguridad imprescindible antes de ofrecer licencias
1. **Repositorio privado:** cambiar la visibilidad en GitHub y revisar forks, tokens, colaboradores, historial y artefactos públicos. Esto no revoca copias previas.
2. **Acceso obligatorio:** asistente de configuración inicial que cree un administrador; contraseñas con KDF robusto, bloqueo de intentos, recuperación controlada, y permisos aplicados **en el proceso principal Electron, no solo en botones**.
3. **Rol administrador:** configuración, operadores, proveedores sensibles, copias, auditoría, anulación y papelera. Rol supervisor: evaluaciones y resoluciones autorizadas. Operador: altas, consultas y comunicaciones permitidas.
4. **Licencias firmadas Ed25519:** clave privada guardada únicamente en backend; clave pública en instalador; instalación individual, caducidad, renovación, plazo de gracia y control de reloj/revocaciones.
5. **Panel del vendedor y API:** emitir, renovar, suspender y transferir licencias; generar registro de clientes y puestos, mantener logs de activación y protección contra abuso.
6. **Datos comerciales:** política de privacidad, términos EULA, canal de soporte, exportación y derecho a copia de datos al vencer la licencia. Las bases RMA no deben quedar secuestradas por el vencimiento.
7. **Instalador y actualizaciones:** firma de código Authenticode, canal estable, migraciones y pruebas de actualización sin pérdida de datos, backup/restauración verificados.
8. **Pruebas de aceptación:** Windows limpio x64, instalación/desinstalación, RMA rápido, múltiples clientes, webcam/carga JPG, duplicado A4, PDFs, respaldo, restauración, permisos y licencias.

## Implementado en esta etapa
- Anulación auditada con motivo y operador; conserva el número RMA.
- Papelera reversible; los registros se conservan y pueden restaurarse.
- Tests básicos de papelera, anulación y verificación de licencias.
- Verificador criptográfico offline `license.js` con pruebas de alteración, dispositivo y expiración.

## Pendiente y no incluido todavía
- Autenticación y autorización del lado de Electron.
- Control real de licencia en ejecución y activaciones.
- Herramienta de generación de licencias y servidor de licencias.
- Revocación y reasignación seguras.
- Eliminación irreversible (se difiere por seguridad y obligaciones de conservación).
- Validación de interfaz y pruebas completas en Windows, firma digital del instalador.

## Seguridad y límites
- La anulación y papelera actuales **no requieren permisos** hasta completar el sistema de usuarios; no entregarlas comercialmente como controles restringidos.
- La ofuscación Electron o ASAR no protegen efectivamente el código ante ingeniería inversa.
- No almacenar ni publicar claves privadas, tokens o datos de clientes en repositorios, builds o logs.
