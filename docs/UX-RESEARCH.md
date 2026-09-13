# Investigación UX/UI aplicada

Fecha de consulta: 2026-09-13.

## Referencias

| Producto | Patrón observado | Aplicación en TaskMaster | Fuente |
|---|---|---|---|
| Todoist | Captura rápida, prioridades visibles, filtros y vistas enfocadas | “Nueva tarea” conserva máxima jerarquía; filtros y carga semanal se muestran solo dentro del espacio de trabajo | https://www.todoist.com/features |
| Asana | Separación clara entre presentación pública, acceso y espacio de trabajo | TaskMaster distingue los estados PUBLIC, GUEST y AUTHENTICATED | https://asana.com/product |
| Linear | Interfaz de alta densidad controlada, superficies limpias y acciones primarias evidentes | Tarjetas con poco ruido, tipografía fuerte y un CTA dominante por sección | https://linear.app/features |
| Microsoft To Do | Organización personal simple y foco en actividades próximas | Resumen, fechas límite, progreso y modo invitado con baja fricción | https://www.microsoft.com/en-us/microsoft-365/microsoft-to-do-list-app |

## Decisiones

1. La landing explica el producto; no muestra controles operativos.
2. El espacio de trabajo aparece únicamente después de iniciar sesión, registrarse,
   autenticarse con Google o elegir conscientemente el modo invitado.
3. El invitado puede probar la gestión local, pero ve las integraciones bloqueadas con una
   explicación y una ruta clara para crear una cuenta.
4. Las integraciones se presentan primero como beneficios y luego como acciones dentro del
   espacio de trabajo.
5. El diseño utiliza composiciones CSS y SVG locales para evitar fotografías genéricas,
   hotlinks y dependencias visuales sin licencia.
