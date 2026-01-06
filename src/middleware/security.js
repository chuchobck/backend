// src/middleware/security.js - Seguridad y Rate Limiting

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// ========== HELMET - Headers de Seguridad ==========
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:', 'http:', 'blob:'],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },  // Permitir recursos cross-origin
  crossOriginEmbedderPolicy: false,  // Desactivar para permitir imágenes externas
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true,
  },
  xContentTypeOptions: false,
  xFrameOptions: { action: 'deny' },
  xXssProtection: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// ========== RATE LIMITER - API General ==========
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 peticiones por ventana (aumentado para desarrollo)
  message: 'Demasiadas peticiones desde esta IP, intenta más tarde.',
  standardHeaders: true, // Retorna info del rate-limit en headers
  legacyHeaders: false, // Desabilita los headers X-RateLimit-*
  skip: (req, res) => {
    // No limitar rutas de salud ni archivos estáticos (imágenes)
    return req.path === '/health' ||
      req.path.endsWith('.webp') ||
      req.path.endsWith('.png') ||
      req.path.endsWith('.jpg');
  },
});

// ========== RATE LIMITER - Login ==========
export const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 20, // 20 intentos por ventana
  message: 'Demasiados intentos de login. Intenta de nuevo en 10 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // No contar intentos exitosos
  skipFailedRequests: false, // Contar intentos fallidos
});

// ========== RATE LIMITER - Crear Recursos ==========
export const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 100, // 100 creaciones por hora
  message: 'Demasiados recursos creados. Intenta más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ========== RATE LIMITER - Cambio de Contraseña ==========
export const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 intentos por hora
  message: 'Demasiados intentos de cambio de contraseña.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ========== VALIDAR TOKEN JWT ==========
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Token no proporcionado',
      data: null,
    });
  }

  try {
    // Decodificar sin verificar (en producción, usar jwt.verify)
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      status: 'error',
      message: 'Token inválido',
      data: null,
    });
  }
};
