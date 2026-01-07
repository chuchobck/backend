// src/app.js - Configuración de la aplicación Express sin .listen()

import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import routes from "./routes/index.js";
import { corsConfig } from "./config/cors.js";
import { correlationId } from "./middleware/correlation.js";
import { helmetMiddleware, apiLimiter } from "./middleware/security.js";

// Cargar variables de entorno
dotenv.config();

const app = express();

// ========== MIDDLEWARE GLOBAL ==========

// 1. Headers de seguridad (Helmet)
app.use(helmetMiddleware);

// 2. Rate Limiting (200 peticiones/15min)
app.use(apiLimiter);

// 3. CORS configurado para los 3 frontends
app.use(cors(corsConfig));

// 4. Parsear JSON
app.use(express.json());

// 5. Correlation ID para trazabilidad
app.use(correlationId);

// 6. Logger optimizado con medición de latencia (sin memory leak)
const logRequest = (req, res, next) => {
  const start = Date.now();
  const time = new Date().toISOString();
  console.log(`[${time}] → ${req.method} ${req.url}`);
  const onFinish = () => {
    const duration = Date.now() - start;
    console.log(`[${time}] ← ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  };
  res.once('finish', onFinish);
  res.once('close', () => {
    res.removeListener('finish', onFinish);
  });
  next();
};

app.use(logRequest);

// 7. Middleware CORS para archivos estáticos (imágenes)
app.use((req, res, next) => {
  if (req.path.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  }
  next();
});

// 8. Servir archivos estáticos (imágenes)
app.use('/logos', express.static(path.join(process.cwd(), 'public/logos')));
app.use('/productos', express.static(path.join(process.cwd(), 'public/productos')));
app.use('/promociones', express.static(path.join(process.cwd(), 'public/promociones')));

// ========== RUTAS ==========

// Health check
app.get('/health', (req, res) => {
  const modules = routes.stack
    .filter(layer => layer.name === 'router')
    .map(layer => {
      return layer.regexp.source
        .replace('\\/?', '')
        .replace('(?=\\/|$)', '')
        .replace('^', '')
        .replace('\\/', '')
        .replace(/\\\//g, '/');
    });

  res.json({
    status: 'success',
    message: 'API funcionando correctamente',
    data: {
      version: 'v1',
      timestamp: new Date().toISOString(),
      modules
    }
  });
});

// API versionada
app.use('/api/v1', routes);
// Compat sin versión
app.use('/api', routes);

// ========== MANEJO DE ERRORES ==========

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Endpoint no encontrado: ${req.method} ${req.url}`,
    data: null
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('🔥 Error:', err.message);
  console.error(err.stack);

  let statusCode = 500;
  let message = 'Error interno del servidor';

  if (err.code === 'P2002') {
    statusCode = 409;
    message = 'Ya existe un registro con esos datos';
  } else if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Registro no encontrado';
  } else if (err.code?.startsWith('P2')) {
    statusCode = 400;
    message = 'Error en la operación de base de datos';
  }

  if (err.message.includes('CORS')) {
    statusCode = 403;
    message = err.message;
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    error: process.env.NODE_ENV === 'production' ? undefined : err.message,
    data: null
  });
});

export default app;
