// src/config/cors.js - Configuración de CORS

// Lista de orígenes permitidos
const allowedOrigins = [
  // Desarrollo local
  "http://localhost:3000",  // React default dev server
  "http://localhost:3001",  // BARBOX Frontend (npm start)
  "http://localhost:5173",  // Vite dev server
  "http://localhost:5174",  // POS dev
  // Producción - Agregar tus dominios de Vercel aquí
  "https://e-commerce-chuchobck.vercel.app",
  "https://barbox.vercel.app",
  // Frontend en Vercel proporcionado
  "https://e-commerce-nu-three-87.vercel.app",
  // Nuevos dominios de Vercel (previews y producción)
  "https://e-commerce-mbcyrqxt0-chuchos-projects-4630041d.vercel.app",
  // Agregar más dominios según necesites
  process.env.FRONTEND_URL,  // Variable de entorno opcional
].filter(Boolean);  // Elimina valores undefined/null

// Función para validar origen (permite IPs de red local)
const validateOrigin = (origin, callback) => {
  // Permitir requests sin origin (Postman, mobile apps, server-side)
  if (!origin) return callback(null, true);

  // Permitir localhost
  if (
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1")
  ) {
    return callback(null, true);
  }

  // ✅ Permitir cualquier frontend en Vercel
  if (origin.endsWith(".vercel.app")) {
    return callback(null, true);
  }

  // Permitir red local
  const localNetworkPattern =
    /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?$/;

  if (localNetworkPattern.test(origin)) {
    return callback(null, true);
  }

  // Bloquear todo lo demás
  callback(new Error(`Origen no permitido por CORS: ${origin}`), false);
};

export const corsConfig = {
  origin: validateOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Correlation-ID',
    'X-Sistema',
    'X-Requested-With',
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Correlation-ID',
  ],
  credentials: true,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};


export const CLIENT_ORIGINS = allowedOrigins;

