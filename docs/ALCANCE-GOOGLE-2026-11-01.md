# Integraciones de TaskMaster

Por solicitud del usuario, Microsoft 365 queda fuera del paquete activo desde el 1 de noviembre de 2026.

Se mantienen Google Workspace (Drive, Docs, Calendar, Gmail y Classroom) y YouTube, con autorización independiente. Se conserva el inicio de sesión con Google y el acceso local por correo y contraseña.

Se retiraron tarjetas, botones, consultas, subida a OneDrive, OAuth y renovación de tokens Microsoft del backend principal. El estado de conexiones solo consulta Google y YouTube. Las credenciales Microsoft ya no se solicitan en .env.example. No se modificaron cuentas externas, secretos de producción ni documentos de la base de datos.

Copia de seguridad previa: backups/antes-retirar-microsoft-20261101.zip. Los informes anteriores y módulos históricos no representan el alcance activo. La tesis todavía debe actualizarse para indicar que Microsoft fue excluido.

La retirada no demuestra por sí sola una nueva validación real de Google. Las pruebas anteriores están en AUDITORIA-INTEGRACIONES-2026-09-30.md. La subida privada de YouTube sigue pendiente.
