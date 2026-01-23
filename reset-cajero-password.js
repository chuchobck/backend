import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetCajeroPassword() {
  try {
    console.log('🔐 Reseteando contraseña del cajero...\n');
    
    // Buscar el cajero
    const usuario = await prisma.usuario.findFirst({
      where: {
        usuario: 'cajero.cue@barbox.com'
      },
      include: {
        empleado: true
      }
    });

    if (!usuario) {
      console.log('❌ Usuario cajero.cue@barbox.com no encontrado');
      return;
    }

    // Actualizar contraseña a 123456
    const newPasswordHash = await bcrypt.hash('123456', 10);
    
    await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: { password_hash: newPasswordHash }
    });

    console.log('✅ Contraseña actualizada correctamente');
    console.log('   Usuario: cajero.cue@barbox.com');
    console.log('   Nueva contraseña: 123456');
    console.log('   Rol:', usuario.empleado?.rol || 'N/A');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetCajeroPassword();
