// src/server.js - Servidor principal con seguridad JWT

import app from '../src/app.js';

// Cargar variables de entorno
// La app y middlewares están definidos en src/app.js

// ========== INICIAR SERVIDOR ==========


// Mostrar la URL de conexión a la base de datos al iniciar el servidor
console.log('Conectando a la base de datos:', process.env.DATABASE_URL);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           🚀 API REST SEGURA - SISTEMA DE GESTIÓN              ║
╠════════════════════════════════════════════════════════════════╣
║  Servidor:     http://localhost:${PORT}                          ║
║  Health:       http://localhost:${PORT}/health                   ║
║  API Base:     http://localhost:${PORT}/api/v1                   ║
║  Imágenes:     http://localhost:${PORT}/logos & /productos       ║
╠════════════════════════════════════════════════════════════════╣
║  🔐 SEGURIDAD ACTIVADA:                                        ║
║  ✓ JWT Authentication                                          ║
║  ✓ Helmet (Headers seguros)                                    ║
║  ✓ Rate Limiting (200 req/15min)                               ║
║  ✓ Login Limiter (20 intentos/10min)                           ║
║  ✓ CORS (Multiple origins)                                     ║
║  ✓ XSS Protection                                              ║
║  ✓ Input Validation & Sanitization                             ║
╠════════════════════════════════════════════════════════════════╣
║  FRONTENDS PERMITIDOS:                                         ║
║  • http://localhost:5173 - E-commerce (BARBOX)                 ║
║  • http://localhost:5174 - POS                                 ║
║  • http://localhost:5175 - Backoffice Admin                    ║
╠════════════════════════════════════════════════════════════════╣
║  ⚡ OPTIMIZACIONES ACTIVAS:                                    ║
║  ✓ Connection Pooling                                          ║
║  ✓ Memory Leak Prevention                                      ║
║  ✓ Graceful Shutdown                                           ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

// Configurar timeout del servidor (30 segundos)
server.timeout = 30000;
server.keepAliveTimeout = 65000; // Debe ser mayor que el timeout del load balancer
server.headersTimeout = 66000; // Debe ser mayor que keepAliveTimeout

// Graceful shutdown del servidor
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  ${signal} recibido. Cerrando servidor...`);
  
  server.close(() => {
    console.log('✅ Servidor HTTP cerrado');
    process.exit(0);
  });
  
  // Si el servidor no se cierra en 10 segundos, forzar salida
  setTimeout(() => {
    console.error('⚠️  Forzando cierre del servidor...');
    process.exit(1);
  }, 10000);
};

// Escuchar señales de terminación
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

export default app;
