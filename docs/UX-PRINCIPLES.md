# Principios UX obligatorios de TaskMaster

Toda función debe evaluarse desde la perspectiva de la persona que intenta completar una
tarea, no desde la estructura técnica del sistema.

## Criterios de aceptación

1. **Resultado evidente.** Cada acción debe decir qué obtiene la persona: «Enviar correo»,
   «Abrir Drive» o «Vincular con TaskMaster»; evitar nombres de endpoints, tokens o APIs.
2. **Esfuerzo mínimo.** No pedir información que el sistema ya conoce ni repetir permisos
   que no son necesarios para la acción actual.
3. **Lenguaje humano.** Los mensajes explican qué ocurrió, cómo afecta al usuario y qué puede
   hacer después. Los detalles técnicos se registran en el servidor, no se muestran como
   solución al usuario.
4. **Recuperación clara.** Todo error recuperable debe ofrecer un siguiente paso concreto.
5. **Control y privacidad.** Antes de vincular una cuenta se explica el beneficio, el permiso
   solicitado y cómo retirarlo. Abrir un servicio externo no debe confundirse con autorizarlo.
6. **Estados completos.** Cada flujo contempla reposo, carga, vacío, éxito, error, sin conexión,
   sesión vencida y permiso insuficiente.
7. **Accesibilidad.** Contraste WCAG AA, foco visible, navegación por teclado, controles de al
   menos 44 × 44 px, anuncios `aria-live` y respeto de `prefers-reduced-motion`.
8. **Diseño adaptable.** La tarea principal debe seguir siendo comprensible y cómoda en móvil,
   tableta y escritorio.

## Mensajes

- Error: explicar el problema sin culpar y ofrecer una acción posible.
- Confirmación: decir qué se completó y evitar interrumpir innecesariamente.
- Permiso: explicar para qué se usará antes de solicitarlo.
- Operación lenta: mostrar progreso y evitar acciones duplicadas.

Estas reglas forman parte de los requisitos no funcionales y deben revisarse junto con las
pruebas técnicas antes de fusionar cambios a `main`.
