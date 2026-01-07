// 🟢 PERSONA 2 – Módulo F5: Gestión de Facturas
import prisma from '../config/database.js';

/**
 * F5.4.1 – Consulta general de facturas
 * GET /api/v1/facturas
 */
export const listarFacturas = async (req, res, next) => {
  try {
    const facturas = await prisma.factura.findMany({
      include: {
        cliente: true,
        iva: true
      },
      orderBy: { fecha: 'desc' }
    });

    return res.json({
      status: 'success',
      message: 'Facturas obtenidas correctamente',
      data: facturas
    });
  } catch (err) {
    // E1 – Desconexión
    next(err);
  }
};

/**
 * F5.4.2 – Consulta de facturas por parámetros
 * GET /api/v1/facturas/buscar
 * Búsqueda unificada por: id, cliente, fechas, estado
 */
export const buscarFacturas = async (req, res, next) => {
  try {
    const { id, cliente, fechaDesde, fechaHasta, estado } = req.query;

    // Si se busca por ID, usar findUnique con detalle completo
    if (id) {
      const factura = await prisma.factura.findUnique({
        where: { id_factura: id },
        include: {
          cliente: true,
          detalle_factura: {
            include: { producto: true }
          },
          iva: true
        }
      });

      if (!factura) {
        return res.status(404).json({
          status: 'error',
          message: 'La factura no existe.',
          data: null
        });
      }

      return res.json({
        status: 'success',
        message: 'Factura obtenida correctamente',
        data: factura
      });
    }

    // E5 – Parámetros faltantes (solo si no hay ID)
    if (!cliente && !fechaDesde && !fechaHasta && !estado) {
      return res.status(400).json({
        status: 'error',
        message: 'Ingrese al menos un criterio de búsqueda (cliente, fechas o estado)',
        data: null
      });
    }

    // Construir filtros dinámicamente
    const whereClause = {};

    if (estado) {
      whereClause.estado = estado;
    }

    if (cliente) {
      whereClause.cliente = {
        OR: [
          { nombre1: { contains: cliente, mode: 'insensitive' } },
          { apellido1: { contains: cliente, mode: 'insensitive' } },
          { ruc_cedula: { contains: cliente } }
        ]
      };
    }

    if (fechaDesde || fechaHasta) {
      whereClause.fecha = {};
      if (fechaDesde) whereClause.fecha.gte = new Date(fechaDesde);
      if (fechaHasta) whereClause.fecha.lte = new Date(fechaHasta);
    }

    const facturas = await prisma.factura.findMany({
      where: whereClause,
      include: {
        cliente: true,
        iva: true
      },
      orderBy: { fecha: 'desc' }
    });

    // E6 – Sin resultados
    if (facturas.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron facturas con los criterios especificados.',
        data: []
      });
    }

    return res.json({
      status: 'success',
      message: 'Búsqueda completada',
      data: facturas
    });
  } catch (err) {
    // E1 – Desconexión
    next(err);
  }
};

/**
 * F5.1 – Ingreso de factura (Local / Online)
 * POST /api/v1/facturas
 * Body esperado:
 * {
 *   "clienteId": "CLI0001",
 *   "detalles": [
 *     { "id_producto": "PRO0001", "cantidad": 2 },
 *     { "id_producto": "PRO0002", "cantidad": 1 }
 *   ],
 *   "canal": "POS" | "WEB",
 *   "pedidoId": "PED0001" | null
 * }
 */
export const crearFactura = async (req, res, next) => {
  try {
    const { clienteId, detalles, canal, pedidoId } = req.body;
    const usuarioId = req.user?.id || 'SYSTEM';

    // Validaciones básicas
    if (!clienteId) {
      return res.status(400).json({ status: 'error', message: 'Cliente es requerido', data: null });
    }

    if (!canal || !['POS', 'WEB'].includes(canal)) {
      return res.status(400).json({ status: 'error', message: 'Canal inválido (POS | WEB)', data: null });
    }

    if (!pedidoId && (!detalles || detalles.length === 0)) {
      return res.status(400).json({ status: 'error', message: 'Debe enviar detalles o pedidoId', data: null });
    }

    // Validar pedido si existe
    if (pedidoId) {
      const pedido = await prisma.pedido.findUnique({
        where: { id_pedido: pedidoId },
        include: { 
          pago: true,  // Array de pagos
          factura: true, 
          pedido_detalle: true 
        }
      });

      console.log(' Pedido encontrado:', pedido?.id_pedido);
      console.log(' Total pagos:', pedido?.pago?.length);

      if (!pedido) {
        return res.status(404).json({ status: 'error', message: 'Pedido no existe', error_code: 'E8', data: null });
      }

      if (pedido.id_cliente && pedido.id_cliente !== clienteId) {
        console.log(' Cliente no coincide. Pedido:', pedido.id_cliente, 'Request:', clienteId);
        return res.status(400).json({ status: 'error', message: 'Pedido no pertenece al cliente', error_code: 'E8', data: null });
      }

      // Verificar si tiene al menos un pago con estado OK (trimear por si hay espacios)
      const tienePagoOK = pedido.pago && pedido.pago.some(p => p.estado?.trim() === 'OK');
      if (!tienePagoOK) {
        console.log('❌ No tiene pagos aprobados. Total pagos:', pedido.pago?.length);
        return res.status(400).json({ status: 'error', message: 'Pedido no tiene pago aprobado', error_code: 'E9', data: null });
      }

      if (pedido.factura) {
        console.log('❌ Ya tiene factura');
        return res.status(400).json({ status: 'error', message: 'Pedido ya tiene factura', error_code: 'E9', data: null });
      }

      // Reemplazar detalles manuales por los del pedido
      req.body.detalles = pedido.pedido_detalle.map(d => ({
        id_producto: d.id_producto,
        cantidad: d.cantidad
      }));
    }

    // Escapar comillas en el JSON para evitar SQL injection
    const detallesJson = JSON.stringify(req.body.detalles).replace(/'/g, "''");
    
    // Llamar a la función wrapper (debe existir previamente en la BD)
    const query = `
      SELECT fn_factura_crear_wrapper(
        '${clienteId}'::VARCHAR(7),
        '${detallesJson}'::JSONB,
        '${canal}'::CHAR(3),
        ${pedidoId ? `'${pedidoId}'` : 'NULL'}::VARCHAR(7),
        '${usuarioId}'::VARCHAR(50)
      ) AS resultado;
    `;

    const resultado = await prisma.$queryRawUnsafe(query);
    console.log('📋 Resultado SP:', resultado);

    const respuesta = resultado?.[0]?.resultado;

    // Manejo de errores extendido
    if (!respuesta || !respuesta.success) {
      const statusCode = {
        'E1': 500,  // Error de conexión
        'E2': 404,  // Cliente no existe
        'E4': 404,  // Producto no existe
        'E5': 400,  // Parámetros faltantes
        'E6': 400,  // Stock insuficiente
        'E7': 500,  // Sin IVA configurado
        'E8': 404,  // Pedido no existe
        'E9': 400   // Pedido inválido (sin pagos / ya facturado)
      }[respuesta.error_code] || 500;

      return res.status(statusCode).json({
        status: 'error',
        message: respuesta.message,
        error_code: respuesta.error_code,
        data: null
      });
    }

    // ⚠️ NO cerramos el carrito porque el CHECK constraint no permite 'CER'
    // La base de datos tiene un constraint que solo permite 'ACT'
    // El carrito simplemente queda con el pedido asociado
    // Cuando el usuario busque su carrito, el backend devolverá null si tiene pedido
    // y el frontend creará un nuevo carrito automáticamente

    // Opcional: enviar factura por email si canal = WEB
    if (canal === 'WEB') {
      // sendEmailFactura(respuesta.data); // Función opcional
    }

    return res.status(201).json({
      status: 'success',
      message: respuesta.message,
      data: respuesta.data
    });

  } catch (err) {
    next(err);
  }
};

/**
 * F5.3 – Modificación de factura abierta
 * PUT /api/v1/facturas/:id
 * 
 * Body esperado:
 * {
 *   "detalles": [
 *     { "id_producto": "PRO0001", "cantidad": 3 },
 *     { "id_producto": "PRO0003", "cantidad": 2 }
 *   ]
 * }
 */
export const editarFacturaAbierta = async (req, res, next) => {
  try {
    const id = req.params.id; // El ID es VARCHAR, no necesita conversión a número
    const { detalles } = req.body;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de factura es requerido',
        data: null
      });
    }

    if (!detalles || detalles.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Debe incluir al menos un producto',
        data: null
      });
    }

    // Obtener usuario de la sesión (si existe)
    const usuarioId = req.user?.id || 'SYSTEM';

    // Llamar al SP que maneja la transacción completa
    const resultado = await prisma.$queryRaw`
      SELECT sp_factura_editar_abierta(
        ${id}::VARCHAR(7),
        ${JSON.stringify(detalles)}::JSONB,
        ${usuarioId}::VARCHAR(50)
      ) as resultado
    `;

    const respuesta = resultado[0]?.resultado;

    // Manejar errores del SP
    if (!respuesta.success) {
      const statusCode = {
        'E2': 404,  // Factura no existe
        'E3': 400,  // Factura no está abierta
        'E4': 404,  // Producto no existe
        'E5': 400,  // Parámetros faltantes
        'E6': 400,  // Stock insuficiente
        'E1': 500   // Error de conexión
      }[respuesta.error_code] || 500;

      return res.status(statusCode).json({
        status: 'error',
        message: respuesta.message,
        error_code: respuesta.error_code,
        data: null
      });
    }

    return res.json({
      status: 'success',
      message: respuesta.message,
      data: respuesta.data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * F5.2 – Anulación de factura
 * POST /api/v1/facturas/:id/anular
 * 
 * Body esperado (opcional):
 * {
 *   "motivo": "Cliente solicitó anulación"
 * }
 */
export const anularFactura = async (req, res, next) => {
  try {
    const id = req.params.id; // El ID es VARCHAR
    const { motivo } = req.body;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de factura es requerido',
        data: null
      });
    }

    // Obtener usuario de la sesión (si existe)
    const usuarioId = req.user?.id || 'SYSTEM';

    // Llamar al SP que maneja la transacción completa
    const resultado = await prisma.$queryRaw`
      SELECT sp_factura_anular(
        ${id}::VARCHAR(7),
        ${motivo || null}::TEXT,
        ${usuarioId}::VARCHAR(50)
      ) as resultado
    `;

    const respuesta = resultado[0]?.resultado;

    // Manejar errores del SP
    if (!respuesta.success) {
      const statusCode = {
        'E2': 404,  // Factura no existe
        'E3': 400,  // Ya está anulada
        'E1': 500   // Error de conexión
      }[respuesta.error_code] || 500;

      return res.status(statusCode).json({
        status: 'error',
        message: respuesta.message,
        error_code: respuesta.error_code,
        data: null
      });
    }

    return res.json({
      status: 'success',
      message: respuesta.message,
      data: respuesta.data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * F5.5 – Impresión de factura
 * GET /api/v1/facturas/:id/imprimir
 * 
 * Retorna los datos formateados para generar el PDF/impresión
 * Incluye: datos tributarios, cliente, detalles, IVA, totales
 */
export const imprimirFactura = async (req, res, next) => {
  try {
    const id = req.params.id; // ID es VARCHAR (FAC0001)
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de factura es requerido',
        data: null
      });
    }
    const factura = await prisma.factura.findUnique({
      where: { id_factura: id },
      include: {
        cliente: {
          include: { ciudad: true }
        },
        detalle_factura: { 
          include: { producto: true } 
        },
        iva: true
      }
    });
    // E2 – Factura inexistente
    if (!factura) {
      return res.status(404).json({
        status: 'error',
        message: 'La factura no existe.',
        data: null
      });
    }
    // Formatear datos para impresión
    const datosImpresion = {
      // Datos de la factura
      numero_factura: factura.id_factura,
      fecha: factura.fecha,
      estado: factura.estado,
      estado_texto: {
        'ABI': 'ABIERTA',
        'CER': 'CERRADA',
        'ANU': 'ANULADA',
        'PEN': 'PENDIENTE'
      }[factura.estado] || factura.estado,
   
      cliente: {
        identificacion: factura.cliente.ruc_cedula,
        nombre_completo: `${factura.cliente.nombre1} ${factura.cliente.nombre2 || ''} ${factura.cliente.apellido1} ${factura.cliente.apellido2 || ''}`.trim(),
        direccion: factura.cliente.direccion,
        telefono: factura.cliente.telefono || factura.cliente.celular,
        email: factura.cliente.email,
        ciudad: factura.cliente.ciudad?.descripcion
      },
      
      detalles: factura.detalle_factura.map((d, idx) => ({
        linea: idx + 1,
        codigo: d.id_producto,
        descripcion: d.producto.descripcion,
        cantidad: d.cantidad,
        precio_unitario: parseFloat(d.precio_unitario),
        subtotal: parseFloat(d.subtotal)
      })),
      
      // Totales
      subtotal: parseFloat(factura.subtotal),
      porcentaje_iva: parseFloat(factura.iva.porcentaje),
      valor_iva: parseFloat(factura.total) - parseFloat(factura.subtotal),
      total: parseFloat(factura.total),
      
      // Marca de agua si está anulada
      marca_agua: factura.estado === 'ANU' ? 'ANULADA' : null
    };

    return res.json({
      status: 'success',
      message: 'Datos de impresión obtenidos correctamente',
      data: datosImpresion
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/facturas/:id/modificar
 * Modificar una factura ya aprobada (solo el mismo día)
 * Usado por: POS, Admin
 * 
 * Validaciones:
 * - Factura debe estar en estado APR
 * - Solo se puede modificar el mismo día de emisión
 * 
 * TODO: Implementar con SP sp_factura_modificar_aprobada
 */
export const modificarFacturaAprobada = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { detalles } = req.body;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de factura es requerido',
        data: null
      });
    }

    if (!detalles || detalles.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Debe incluir al menos un producto',
        data: null
      });
    }

    // Verificar que la factura existe
    const factura = await prisma.factura.findUnique({
      where: { id_factura: id }
    });

    if (!factura) {
      return res.status(404).json({
        status: 'error',
        message: 'La factura no existe.',
        data: null
      });
    }

    // Validar que está aprobada
    if (factura.estado !== 'APR') {
      return res.status(400).json({
        status: 'error',
        message: 'Solo se pueden modificar facturas aprobadas',
        data: null
      });
    }

    // Validar que es del mismo día
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaFactura = new Date(factura.fecha);
    fechaFactura.setHours(0, 0, 0, 0);

    if (fechaFactura.getTime() !== hoy.getTime()) {
      return res.status(400).json({
        status: 'error',
        message: 'Solo se pueden modificar facturas del mismo día',
        data: null
      });
    }

    // TODO: Implementar con SP que maneje stock correctamente
    // Por ahora retorna error indicando que no está implementado
    return res.status(501).json({
      status: 'error',
      message: 'Funcionalidad pendiente de implementar con SP',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

