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

## Deploy (Vercel)

Configurar estas variables en el proyecto de Vercel:

- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Después de setear variables, ejecutar redeploy.
