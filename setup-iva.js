import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupIVA() {
  try {
    console.log('💰 Configurando IVA...\n');
    
    // Verificar IVA existente
    const ivaExistente = await prisma.iva.findMany();
    
    console.log(`Registros IVA encontrados: ${ivaExistente.length}\n`);
    
    if (ivaExistente.length > 0) {
      console.log('IVAs en BD:');
      for (const iva of ivaExistente) {
        console.log(`  - ID: ${iva.id_iva}`);
        console.log(`    Porcentaje: ${iva.porcentaje}%`);
        console.log(`    Estado: ${iva.estado}`);
        console.log(`    Vigencia: ${iva.fecha_inicio} - ${iva.fecha_fin || 'Sin fin'}`);
      }
    }

    // Verificar si hay un IVA activo
    const today = new Date();
    const ivaActivo = ivaExistente.find(iva => 
      iva.estado === 'A' && 
      new Date(iva.fecha_inicio) <= today &&
      (!iva.fecha_fin || new Date(iva.fecha_fin) >= today)
    );

    if (ivaActivo) {
      console.log(`\n✅ IVA activo encontrado (ID: ${ivaActivo.id_iva})`);
      console.log(`   Porcentaje: ${ivaActivo.porcentaje}%\n`);
      return;
    }

    // Si no hay IVA activo, crear uno
    console.log('\n📝 Creando IVA del 15%...');
    
    const nuevoIVA = await prisma.iva.create({
      data: {
        porcentaje: 15.00,
        fecha_inicio: new Date('2024-01-01'),
        fecha_fin: new Date('2030-12-31'),
        estado: 'A'
      }
    });

    console.log(`✅ IVA creado exitosamente`);
    console.log(`   ID: ${nuevoIVA.id_iva}`);
    console.log(`   Porcentaje: ${nuevoIVA.porcentaje}%`);
    console.log(`   Estado: ${nuevoIVA.estado}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

setupIVA();
