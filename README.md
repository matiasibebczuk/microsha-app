# MicroSHA Frontend

Aplicación React + Vite para la gestión de traslados de pasajeros con roles:

- Admin
- Encargado
- Pasajero

## Requisitos

- Node.js 18+
- Variables de entorno configuradas (obligatorias)

## Variables de entorno

Copiá `.env.example` a `.env` y completá:

```dotenv
VITE_API_BASE_URL=https://your-backend-domain.com
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_public_anon_key
```

`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` son obligatorias. Si faltan, la app corta arranque por seguridad.

## Scripts

- `npm run dev`: entorno local
- `npm run build`: build de producción
- `npm run lint`: validación ESLint
- `npm run preview`: preview del build

## Flujo de performance implementado

- Prewarm del backend al abrir la app (`/ping`)
- Prefetch por rol después de autenticación
- Caché en memoria corta para listas frecuentes
- Skeleton loaders y estados vacíos reutilizables
- Paginación en listados largos (historial y pasajeros)

## BB8 (club 1926)

BB8 está disponible en el panel para administradores con membresía de staff del club 1926. El backend verifica la sesión Supabase, el rol y la membresía en cada solicitud; el club se fija en el servidor y no se toma del mensaje.

Las consultas soportadas incluyen próximos traslados, paradas, inscriptos, registro de embarque y ocupación; también búsquedas de personas, historial individual y conteo de pasajeros. Los nombres de personas y traslados se solicitan entre comillas para limitar resultados ambiguos. El registro `boarded` se informa como embarque marcado/sin constancia y no se convierte por sí solo en una inasistencia definitiva.

Las modificaciones habilitadas son cambiar el horario de un traslado abierto, cerrar un traslado abierto sin recorrido activo, crear un pasajero del club y dar de baja a una persona de una inscripción individual. Las bajas requieren nombre exacto de la persona y del traslado; si se libera un lugar confirmado y la ventana está activa, la lista de espera puede avanzar según capacidad y orden existente. BB8 siempre guarda una vista previa de un solo uso, válida cinco minutos, y requiere confirmación explícita. Los cambios se auditan; la ejecución y verificación dependen de la migración `microsha-backend/sql/2026-11-26_bb8_confirmed_operations.sql`. Aplicala en Supabase antes de habilitar el flujo de cambios.

Ejemplos:

- `Mostrame las paradas del traslado "Nombre exacto"`
- `Mostrame la asistencia del traslado "Nombre exacto"`
- `¿Cuántos pasajeros hay?`
- `Buscá a "Apellido Nombre"`
- `Historial de la persona "Apellido Nombre"`
- `Cambiar el horario del traslado "Nombre exacto" a 10:30`
- `Cancelar el traslado "Nombre exacto"` (cierra la inscripción; no elimina el viaje ni sus reservas)
- `Crear usuario "Apellido Nombre" DNI 12345678 socio 123456`
- `Dar de baja a "Apellido Nombre" del traslado "Nombre exacto"`

Sin `OPENAI_API_KEY`, BB8 usa las reglas determinísticas locales. Si se configura en el backend (opcionalmente `OPENAI_MODEL`, por defecto `gpt-4.1-mini`), OpenAI solo clasifica solicitudes genéricas de próximos traslados; nunca recibe resultados de Supabase ni solicitudes con datos identificativos. No genera SQL, no ejecuta acciones y no envía comunicaciones.

La edición de asistencia, eliminación o edición general de usuarios, plantillas, comunicaciones y reportes avanzados no están habilitados. Las bajas de BB8 solo afectan una inscripción individual y nunca eliminan todas las reservas del traslado.

## Deploy (Vercel)

Configurar estas variables en el proyecto de Vercel:

- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Después de setear variables, ejecutar redeploy.
