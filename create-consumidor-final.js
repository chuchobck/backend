import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createConsumidorFinal() {
  try {
    console.log('📝 Creando cliente Consumidor Final...\n');
    
    // Verificar si ya existe
    const existe = await prisma.cliente.findUnique({
      where: {
        ruc_cedula: '9999999999999'
      }
    });

    if (existe) {
      console.log('✅ Cliente Consumidor Final ya existe');
      console.log('   ID:', existe.id_cliente);
      console.log('   Cédula:', existe.ruc_cedula);
      return;
    }

    // Crear cliente
    const cliente = await prisma.cliente.create({
      data: {
        nombre1: 'Consumidor',
        apellido1: 'Final',
        ruc_cedula: '9999999999999',
        id_ciudad: 'UIO',
        origen: 'POS',
        estado: 'ACT',
        email: 'consumidor@final.com'
      }
    });

    console.log('✅ Cliente Consumidor Final creado');
    console.log('   ID:', cliente.id_cliente);
    console.log('   Nombre:', cliente.nombre1, cliente.apellido1);
    console.log('   Cédula:', cliente.ruc_cedula);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createConsumidorFinal();
