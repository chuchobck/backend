// 🟢 PERSONA 2 – Módulo F5: Gestión de Facturas
import prisma from '../lib/prisma.js';

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
 * F5.1 – Ingreso de factura (desde carrito - requiere login en checkout)
 * POST /api/v1/facturas
 * Body esperado:
 * {
 *   "id_cliente": 1,
 *   "id_carrito": "uuid...",  // UUID del carrito
 *   "id_metodo_pago": 1,
 *   "id_sucursal": 1
 * }
 * 
 * Nota: El canal se determina automáticamente:
 * - WEB: si viene de e-commerce (carrito con session_id originalmente)
 * - POS: si viene del sistema POS
 */
export const crearFactura = async (req, res, next) => {
  try {
    const { id_cliente, id_carrito, id_metodo_pago, id_sucursal } = req.body;
    const id_empleado = req.usuario?.id_empleado || null; // Solo si viene desde POS

    // Validaciones básicas
    if (!id_cliente) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Cliente es requerido', 
        data: null 
      });
    }

    if (!id_carrito) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Carrito es requerido', 
        data: null 
      });
    }

    if (!id_metodo_pago) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Método de pago es requerido', 
        data: null 
      });
    }

    if (!id_sucursal) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Sucursal es requerida', 
        data: null 
      });
    }

    // Validar que cliente existe
    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: Number(id_cliente) }
    });

    if (!cliente) {
      return res.status(404).json({
        status: 'error',
        message: 'El cliente no existe',
        data: null
      });
    }

    // Validar que el carrito existe y está activo
    const carrito = await prisma.carrito.findUnique({
      where: { id_carrito },
      include: {
        carrito_detalle: {
          include: { producto: true }
        }
      }
    });

    if (!carrito) {
      return res.status(404).json({
        status: 'error',
        message: 'El carrito no existe',
        data: null
      });
    }

    if (carrito.estado !== 'ACT') {
      return res.status(400).json({
        status: 'error',
        message: 'El carrito no está activo',
        data: null
      });
    }

    if (carrito.id_cliente !== Number(id_cliente)) {
      return res.status(403).json({
        status: 'error',
        message: 'El carrito no pertenece a este cliente',
        data: null
      });
    }

    if (carrito.carrito_detalle.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'El carrito está vacío',
        data: null
      });
    }

    // Determinar canal: WEB para e-commerce, POS para punto de venta
    const canal = id_empleado ? 'POS' : 'WEB';

    // Validar que método de pago existe y está disponible para el canal
    const metodoPago = await prisma.metodo_pago.findUnique({
      where: { id_metodo_pago: Number(id_metodo_pago) }
    });

    if (!metodoPago) {
      return res.status(404).json({
        status: 'error',
        message: 'El método de pago no existe',
        data: null
      });
    }

    if (canal === 'WEB' && !metodoPago.disponible_web) {
      return res.status(400).json({
        status: 'error',
        message: 'El método de pago no está disponible para compras en línea',
        data: null
      });
    }

    if (canal === 'POS' && !metodoPago.disponible_pos) {
      return res.status(400).json({
        status: 'error',
        message: 'El método de pago no está disponible en POS',
        data: null
      });
    }

    // Validar que sucursal existe
    const sucursal = await prisma.sucursal.findUnique({
      where: { id_sucursal: Number(id_sucursal) }
    });

    if (!sucursal) {
      return res.status(404).json({
        status: 'error',
        message: 'La sucursal no existe',
        data: null
      });
    }

    // Validar todos los productos y su disponibilidad
    const detallesValidados = [];
    let subtotal = 0;

    for (const item of carrito.carrito_detalle) {
      const producto = item.producto;

      if (producto.estado !== 'ACT') {
        return res.status(400).json({
          status: 'error',
          message: `El producto ${producto.descripcion} no está disponible`,
          data: null
        });
      }

      if (producto.saldo_actual < item.cantidad) {
        return res.status(400).json({
          status: 'error',
          message: `Stock insuficiente para ${producto.descripcion}. Disponible: ${producto.saldo_actual}`,
          data: null
        });
      }

      const precio_unitario = Number(item.precio_unitario);
      const cantidad = Number(item.cantidad);
      const detalle_subtotal = cantidad * precio_unitario;
      subtotal += detalle_subtotal;

      detallesValidados.push({
        id_producto: item.id_producto,
        cantidad,
        precio_unitario: parseFloat(precio_unitario.toFixed(3)),
        subtotal: parseFloat(detalle_subtotal.toFixed(3))
      });
    }

    // Obtener el IVA actual
    const iva = await prisma.iva.findFirst({
      where: { fecha_fin: null, estado: 'V' }
    });

    if (!iva) {
      return res.status(500).json({
        status: 'error',
        message: 'No existe un porcentaje de IVA configurado',
        data: null
      });
    }

    const porcentaje_iva = Number(iva.porcentaje);
    const iva_valor = parseFloat((subtotal * porcentaje_iva / 100).toFixed(3));
    const total = parseFloat((subtotal + iva_valor).toFixed(3));

    // Usar transacción para crear factura y desactivar carrito
    const resultado = await prisma.$transaction(async (tx) => {
      // Generar ID de factura (FAC000001, FAC000002, etc.)
      const ultimaFactura = await tx.factura.findFirst({
        orderBy: { id_factura: 'desc' },
        select: { id_factura: true }
      });

      let siguienteNumero = 1;
      if (ultimaFactura && ultimaFactura.id_factura) {
        const matches = ultimaFactura.id_factura.match(/\d+/);
        if (matches) {
          siguienteNumero = parseInt(matches[0]) + 1;
        }
      }

      const id_factura = `FAC${String(siguienteNumero).padStart(6, '0')}`;

      // Crear factura
      const factura = await tx.factura.create({
        data: {
          id_factura,
          id_canal: canal,
          id_cliente: Number(id_cliente),
          id_carrito: id_carrito,
          id_empleado,
          id_sucursal: Number(id_sucursal),
          id_metodo_pago: Number(id_metodo_pago),
          id_iva: iva.id_iva,
          subtotal: parseFloat(subtotal.toFixed(3)),
          total: total,
          estado: 'EMI' // Emitida
        }
      });

      // Crear detalles de factura
      for (const detalle of detallesValidados) {
        await tx.factura_detalle.create({
          data: {
            id_factura,
            id_producto: detalle.id_producto,
            cantidad: detalle.cantidad,
            precio_unitario: detalle.precio_unitario,
            subtotal: detalle.subtotal
          }
        });

        // Descontar stock del producto
        await tx.producto.update({
          where: { id_producto: detalle.id_producto },
          data: {
            saldo_actual: {
              decrement: detalle.cantidad
            }
          }
        });
      }

      // Desactivar carrito (ya fue procesado)
      await tx.carrito.update({
        where: { id_carrito },
        data: { estado: 'PRO' } // Procesado
      });

      return factura;
    });

    // Opcional: enviar factura por email si canal = WEB
    if (canal === 'WEB' && cliente.email) {
      // sendEmailFactura(resultado, cliente.email); // Función opcional
    }

    return res.status(201).json({
      status: 'success',
      message: 'Factura creada correctamente',
      data: {
        id_factura: resultado.id_factura,
        fecha: resultado.fecha_emision,
        subtotal: resultado.subtotal,
        total: resultado.total,
        estado: resultado.estado,
        canal
      }
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
 *     { "id_producto": "PRO0001", "cantidad": 3, "precio_unitario": 100.00 },
 *     { "id_producto": "PRO0003", "cantidad": 2, "precio_unitario": 50.00 }
 *   ]
 * }
 */
export const editarFacturaAbierta = async (req, res, next) => {
  try {
    const id_factura = req.params.id;
    const { detalles } = req.body;

    if (!id_factura) {
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

    // Validar que la factura existe
    const factura = await prisma.factura.findUnique({
      where: { id_factura },
      include: {
        factura_detalle: true,
        iva: true
      }
    });

    if (!factura) {
      return res.status(404).json({
        status: 'error',
        message: 'La factura no existe',
        data: null
      });
    }

    // Validar que está emitida (EMI)
    if (factura.estado !== 'EMI') {
      return res.status(400).json({
        status: 'error',
        message: 'Solo se pueden modificar facturas emitidas (estado EMI)',
        data: null
      });
    }

    // Validar todos los productos
    let subtotal = 0;
    const detallesValidados = [];

    for (const item of detalles) {
      const producto = await prisma.producto.findUnique({
        where: { id_producto: item.id_producto }
      });

      if (!producto) {
        return res.status(404).json({
          status: 'error',
          message: `El producto ${item.id_producto} no existe`,
          data: null
        });
      }

      const cantidad = Number(item.cantidad);
      const precio_unitario = Number(item.precio_unitario || producto.precioVenta);

      if (!precio_unitario || precio_unitario <= 0) {
        return res.status(400).json({
          status: 'error',
          message: `Precio unitario inválido para producto ${item.id_producto}`,
          data: null
        });
      }

      const detalle_subtotal = cantidad * precio_unitario;
      subtotal += detalle_subtotal;

      detallesValidados.push({
        id_producto: item.id_producto,
        cantidad,
        precio_unitario: parseFloat(precio_unitario.toFixed(3)),
        subtotal: parseFloat(detalle_subtotal.toFixed(3))
      });
    }

    // Calcular nuevos totales
    const porcentaje_iva = Number(factura.iva.porcentaje);
    const iva_valor = parseFloat((subtotal * porcentaje_iva / 100).toFixed(3));
    const total = parseFloat((subtotal + iva_valor).toFixed(3));

    // Usar transacción para actualizar
    const resultado = await prisma.$transaction(async (tx) => {
      // Eliminar detalles anteriores
      await tx.factura_detalle.deleteMany({
        where: { id_factura }
      });

      // Crear nuevos detalles
      for (const detalle of detallesValidados) {
        await tx.factura_detalle.create({
          data: {
            id_factura,
            id_producto: detalle.id_producto,
            cantidad: detalle.cantidad,
            precio_unitario: detalle.precio_unitario,
            subtotal: detalle.subtotal
          }
        });
      }

      // Actualizar factura
      const facturaActualizada = await tx.factura.update({
        where: { id_factura },
        data: {
          subtotal: parseFloat(subtotal.toFixed(3)),
          total: total
        },
        include: {
          factura_detalle: {
            include: { producto: true }
          }
        }
      });

      return facturaActualizada;
    });

    return res.json({
      status: 'success',
      message: 'Factura actualizada correctamente',
      data: {
        id_factura: resultado.id_factura,
        subtotal: resultado.subtotal,
        total: resultado.total,
        estado: resultado.estado,
        detalles: resultado.factura_detalle
      }
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
    const id_factura = req.params.id;
    const { motivo } = req.body;

    if (!id_factura) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de factura es requerido',
        data: null
      });
    }

    // Validar que la factura existe
    const factura = await prisma.factura.findUnique({
      where: { id_factura }
    });

    if (!factura) {
      return res.status(404).json({
        status: 'error',
        message: 'La factura no existe',
        data: null
      });
    }

    // Validar que NO está ya anulada
    if (factura.estado === 'ANU') {
      return res.status(409).json({
        status: 'error',
        message: 'La factura ya se encuentra anulada',
        data: null
      });
    }

    // Actualizar estado a ANU
    const facturaAnulada = await prisma.factura.update({
      where: { id_factura },
      data: { 
        estado: 'ANU'
        // Nota: Si hay campo motivo_anulacion en la tabla, descomentar:
        // motivo_anulacion: motivo || null
      }
    });

    return res.json({
      status: 'success',
      message: 'Factura anulada correctamente',
      data: {
        id_factura: facturaAnulada.id_factura,
        estado: facturaAnulada.estado,
        fecha_emision: facturaAnulada.fecha_emision
      }
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
        factura_detalle: { 
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
  /**
   * Formatear datos para impresión
   */
  const datosImpresion = {
    // Datos de la factura
    numero_factura: factura.id_factura,
    fecha: factura.fecha_emision,
    estado: factura.estado,
    estado_texto: {
      'EMI': 'EMITIDA',
      'ANU': 'ANULADA'
    }[factura.estado] || factura.estado,
   
      cliente: {
        identificacion: factura.cliente.ruc_cedula,
        nombre_completo: `${factura.cliente.nombre1} ${factura.cliente.nombre2 || ''} ${factura.cliente.apellido1} ${factura.cliente.apellido2 || ''}`.trim(),
        direccion: factura.cliente.direccion,
        telefono: factura.cliente.telefono || factura.cliente.celular,
        email: factura.cliente.email,
        ciudad: factura.cliente.ciudad?.descripcion
      },
      
      detalles: factura.factura_detalle.map((d, idx) => ({
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

