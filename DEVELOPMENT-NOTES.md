# TECMOV RMA — pruebas pendientes

Cambios en esta rama: alta atómica de clientes junto a RMA; edición con bitácora; alertas preliminares por 7 días; recuperación fuera de línea de respaldo con copia previa.

Para restaurar una copia: cerrar el programa, crear primero copia externa de la carpeta actual, verificar con `node RESTAURAR-DATOS.js respaldo.rma-backup directorio-de-datos` y agregar `--confirmar-cerrada` solo después de comprobar las rutas. La restauración valida checksum y SQLite. Probar exclusivamente con una copia de la información.

Pendiente antes de fusionar: validar Windows, seguridad de accesos, roles, plazos, flujo completo de fábrica, informes PDF y restauración bajo fallas. No cargar datos reales en GitHub.
