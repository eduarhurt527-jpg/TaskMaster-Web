# Revisión de alcance de TaskMaster

Fecha: 13 de octubre de 2026. Proyecto: TaskMaster-final. Cambios locales, sin nueva publicación confirmada.

## Correcciones realizadas

- TaskViewModel.registrarPomodoro confirma el resultado antes de modificar el estado. Una respuesta negativa o excepción conserva el contador.
- PomodoroView distingue el fin del descanso del fin del enfoque. Evita solicitudes simultáneas y libera controles tras errores. No muestra confirmación de guardado cuando este falla.
- DashboardView muestra sesiones registradas en las tareas y minutos estimados de 25 minutos por sesión. No presenta totales acumulados como cifras diarias o semanales. No existe historial fechado para reconstruir esas cifras.
- index.html incorpora versiones de los tres scripts modificados para renovar la caché del navegador.
- Respaldo previo: backups/antes-pomodoro-20261013. No contiene credenciales.

## Validación

36 pruebas automatizadas aprobadas, ninguna fallida. Se conservan las 30 anteriores y se añaden seis de Pomodoro: rechazo del servidor, excepción de red, contador numérico, descanso sin incremento, doble clic y recuperación de controles. Son pruebas controladas; no equivalen a ejecución con cuentas reales.

## Requisitos pendientes de cierre

| Requisito | Evidencia pendiente |
|---|---|
| HU-01 | Registro real, acceso, salida y ventana privada; confirmación de correo no implementada |
| HU-02 | Crear, editar, eliminar y recargar en producción; aislamiento entre dos cuentas |
| HU-03 | Fechas vencidas y próximas, prioridades y distintos dispositivos |
| HU-04 | Permisos concedidos/rechazados y avisos; funcionamiento con aplicación cerrada no acreditado |
| HU-05 | Búsqueda y filtros combinados exigidos por la tesis; gráfico con datos conocidos |
| HU-06 | Sesión completa y persistencia tras recargar en producción |
| HU-07 | Rachas y niveles no encontrados; decidir implementación o ajustar el alcance documentado |

## Integraciones

El informe AUDITORIA-INTEGRACIONES-2026-09-30.md registra las pruebas reales anteriores: Calendar, Docs, Drive y Gmail confirmados; Classroom respondió sin cursos. YouTube vinculado, sin prueba de subida. Microsoft pendiente de registro y configuración. No se repitieron hoy estas operaciones ni se concedieron nuevos permisos.

## Coherencia de la tesis

La última copia es TESIS_TaskMaster_ZOTERO_ENFOQUE_REVISADO.docx, en la carpeta superior. El despliegue comprobado anteriormente es Vercel con dominio de Hostinger; las referencias a subir Node.js a public_html no describen ese despliegue. Deben revisarse PWA (sw.js y manifest.json no confirmados), gamificación, períodos estadísticos, fechas y evidencias de entrevistas/encuestas. No se deben inventar resultados ni reformularlos como pruebas completadas.

La validación local permite continuar, pero no permite declarar cerrado todo el alcance ni la publicación de estos cambios.
