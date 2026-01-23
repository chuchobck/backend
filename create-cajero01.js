import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createCajero01() {
  try {
    console.log('👤 Creando usuario cajero01...\n');
    
    // Verificar si ya existe
    const existe = await prisma.usuario.findFirst({
      where: {
        usuario: 'cajero01'
      }
    });

    if (existe) {
      console.log('⚠️  Usuario cajero01 ya existe');
      console.log('   ID:', existe.id_usuario);
      console.log('   Estado:', existe.estado);
      return;
    }

    // Crear usuario
    const passwordHash = await bcrypt.hash('123456', 10);
    
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        usuario: 'cajero01',
        password_hash: passwordHash,
        estado: 'ACT'
      }
    });

    console.log('✅ Usuario creado exitosamente');
    console.log('   ID Usuario:', nuevoUsuario.id_usuario);
    console.log('   Usuario: cajero01');
    console.log('   Contraseña: 123456');

    // Crear empleado asociado
    const empleado = await prisma.empleado.create({
      data: {
        id_usuario: nuevoUsuario.id_usuario,
        id_rol: 3, // Rol CAJERO
        cedula: '1234567890',
        nombre1: 'Cajero',
        apellido1: 'POS Uno',
        telefono: '0999999999',
        estado: 'ACT',
        id_sucursal: 1
      }
    });

    console.log('\n✅ Empleado creado exitosamente');
    console.log('   ID Empleado:', empleado.id_empleado);
    console.log('   Nombre: Cajero POS Uno');
    console.log('   Rol: CAJERO');
    console.log('\n📱 Puedes ingresar al POS con:');
    console.log('   Usuario: cajero01');
    console.log('   Contraseña: 123456');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createCajero01();
