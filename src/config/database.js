// src/config/database.js - Configuración de Prisma optimizada

import prisma from '../lib/prisma.js';

// Intentar conectar al iniciar (no bloqueante)
prisma
  .$connect()
  .then(() => console.log('✅ Base de datos conectada'))
  .catch((err) => console.error('❌ Error conectando a BD:', err));

// Graceful shutdown - cerrar conexiones al terminar el proceso
const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️  ${signal} recibido. Cerrando conexiones...`);
  try {
    await prisma.$disconnect();
    console.log('✅ Conexión a BD cerrada correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al cerrar conexión:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('beforeExit', () => gracefulShutdown('beforeExit'));

export default prisma;
