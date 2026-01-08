// src/config/database.js - Configuración de Prisma optimizada

import { PrismaClient } from "@prisma/client";

// Singleton pattern para evitar múltiples instancias
let prisma;

if (process.env.NODE_ENV === 'production') {
  // En producción preferimos DIRECT_URL (conexión directa) para evitar
  // problemas con prepared statements cuando se usa un pooler (pgbouncer)
  const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  prisma = new PrismaClient({
    log: ['error'],
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });
} else {
  // En desarrollo, reutilizar la instancia global para evitar múltiples conexiones
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['warn', 'error'],
      // Configuración de pool de conexiones optimizada
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  prisma = global.prisma;
}

// Verificar conexión al iniciar
prisma.$connect()
  .then(() => console.log('✅ Base de datos conectada con pool optimizado'))
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

// Escuchar señales de terminación
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('beforeExit', () => gracefulShutdown('beforeExit'));

export default prisma;
