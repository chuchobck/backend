// src/config/cors.js - Configuración de CORS

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://e-commerce-chuchobck.vercel.app",
  "https://barbox.vercel.app",
  "https://e-commerce-nu-three-87.vercel.app",
  "https://e-commerce-mbcyrqxt0-chuchos-projects-4630041d.vercel.app",
  "https://e-commerce-woad-omega.vercel.app",
  "https://e-commerce-782t79gv3-chuchos-projects-4630041d.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

const validateOrigin = (origin, callback) => {
  // Permitir requests sin origin
  if (!origin) return callback(null, true);
  
  // Permitir localhost
  if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) {
    return callback(null, true);
  }
  
  // Permitir cualquier dominio de Vercel
  if (origin.endsWith(".vercel.app")) {
    return callback(null, true);
  }
  
  // Permitir red local
  const localNetworkPattern = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?$/;
  if (localNetworkPattern.test(origin)) {
    return callback(null, true);
  }
  
  // Si está en la lista permitida
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  
  console.log('❌ Origen bloqueado:', origin);
  callback(new Error(`Origen no permitido por CORS: ${origin}`), false);
};

export const corsConfig = {
  origin: validateOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Correlation-ID',
    'X-Sistema'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Correlation-ID'],
  credentials: true,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

export const CLIENT_ORIGINS = allowedOrigins;
