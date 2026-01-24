// src/controllers/factura.controller.js
// 🟢 Módulo F5: Gestión de Facturas
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
        iva: true,
        canal_venta: true,
        metodo_pago: true
      },
      orderBy: { fecha_emision: 'desc' }
    });

    return res.json({
      status: 'success',
      message: 'Facturas obtenidas correctamente',
      data: facturas
    });
  } catch (err) {
    next(err);
  }
};

/**
 * F5.4.2 – Consulta de facturas por parámetros
 * GET /api/v1/facturas/buscar
 * Query params: id, cliente, fechaDesde, fechaHasta, estado
 */
export const buscarFacturas = async (req, res, next) => {
  try {
    const { id, cliente, fechaDesde, fechaHasta, estado } = req.query;

    // Búsqueda por ID específico
    if (id) {
      const factura = await prisma.factura.findUnique({
        where: { id_factura: id },
        include: {
          cliente: true,
          detalle_factura: {
            include: { producto: true }
          },
          iva: true,
          canal_venta: true,
          sucursal: true,
          metodo_pago: true
        }
      });

      if (!factura) {
        return res.status(404).json({
          status: 'error',
          message: 'La factura no existe',
          data: null
        });
      }

      return res.json({
        status: 'success',
        message: 'Factura obtenida correctamente',
        data: factura
      });
    }

    // Validar que haya al menos un criterio
    if (!cliente && !fechaDesde && !fechaHasta && !estado) {
      return res.status(400).json({
        status: 'error',
        message: 'Ingrese al menos un criterio de búsqueda',
        data: null
      });
    }

    // Construir filtros
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
      whereClause.fecha_emision = {};
      if (fechaDesde) whereClause.fecha_emision.gte = new Date(fechaDesde);
      if (fechaHasta) whereClause.fecha_emision.lte = new Date(fechaHasta);
    }

    const facturas = await prisma.factura.findMany({
      where: whereClause,
      include: {
        cliente: true,
        iva: true,
        canal_venta: true,
        sucursal: true
      },
      orderBy: { fecha_emision: 'desc' }
    });

    if (facturas.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron facturas con los criterios especificados',
        data: []
      });
    }

    return res.json({
      status: 'success',
      message: 'Búsqueda completada',
      data: facturas
    });
  } catch (err) {
    next(err);
  }
};

/**
 * F5.1 – Crear factura desde carrito (Checkout)
 * POST /api/v1/facturas
 * Body: { id_cliente, id_carrito, id_metodo_pago, id_sucursal }
 * 
 * REFACTORIZADO: Usa fn_ingresar_factura() de la BD
 */
export const crearFactura = async (req, res, next) => {
  try {
    const { id_cliente, id_carrito, id_metodo_pago, id_sucursal } = req.body;
    const id_empleado = req.usuario?.id_empleado || null;

    // Validación mínima en Node.js
    if (!id_cliente || !id_carrito || !id_metodo_pago || !id_sucursal) {
      return res.status(400).json({
        status: 'error',
        message: 'Parámetros requeridos: id_cliente, id_carrito, id_metodo_pago, id_sucursal',
        data: null
      });
    }

    // Determinar canal de venta
    const canal_venta = id_empleado ? 'POS' : 'WEB';

    // 🔷 LLAMAR FUNCIÓN DE BD: fn_ingresar_factura()
    const resultado = await prisma.$queryRaw`
      SELECT * FROM fn_ingresar_factura(
        ${Number(id_cliente)}::INTEGER,
        ${id_carrito}::UUID,
        ${Number(id_metodo_pago)}::INTEGER,
        ${Number(id_sucursal)}::INTEGER,
        ${canal_venta}::CHAR(3),
        ${id_empleado}::INTEGER
      )
    `;

    if (!resultado || resultado.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Error al crear factura',
        data: null
      });
    }

    const factura = resultado[0];

    // Validar si BD retornó error
    if (factura.error || factura.mensaje?.includes('Error')) {
      return res.status(400).json({
        status: 'error',
        message: factura.mensaje || 'Error al crear factura',
        data: null
      });
    }

    return res.status(201).json({
      status: 'success',
      message: 'Factura creada correctamente',
      data: factura
    });
  } catch (err) {
    next(err);
  }
};

/**
 * F5.3 – Modificar factura abierta (solo estado EMI)
 * PUT /api/v1/facturas/:id
 * Body: { detalles: [{ id_producto, cantidad, precio_unitario? }] }
 */
export const editarFacturaAbierta = async (req, res, next) => {
  try {
    const { id } = req.params;
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

    // Obtener factura
    const factura = await prisma.factura.findUnique({
      where: { id_factura: id },
      include: {
        detalle_factura: true,
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

    if (factura.estado !== 'EMI') {
      return res.status(400).json({
        status: 'error',
        message: 'Solo se pueden modificar facturas en estado EMI',
        data: null
      });
    }

    // Validar productos y calcular totales
    let subtotal = 0;
    const detallesValidados = [];

    for (const item of detalles) {
      const producto = await prisma.producto.findUnique({
        where: { id_producto: item.id_producto }
      });

      if (!producto) {
        return res.status(404).json({
          status: 'error',
          message: `Producto ${item.id_producto} no existe`,
          data: null
        });
      }

      const cantidad = Number(item.cantidad);
      const precio_unitario = Number(item.precio_unitario || producto.precio_venta);

      if (precio_unitario <= 0) {
        return res.status(400).json({
          status: 'error',
          message: `Precio inválido para ${item.id_producto}`,
          data: null
        });
      }

      const itemSubtotal = cantidad * precio_unitario;
      subtotal += itemSubtotal;

      detallesValidados.push({
        id_producto: item.id_producto,
        cantidad,
        precio_unitario: parseFloat(precio_unitario.toFixed(3)),
        subtotal: parseFloat(itemSubtotal.toFixed(3))
      });
    }

    // Calcular totales
    const porcentajeIva = Number(factura.iva.porcentaje);
    const valorIva = parseFloat((subtotal * porcentajeIva / 100).toFixed(3));
    const total = parseFloat((subtotal + valorIva).toFixed(3));

    // Transacción para actualizar
    const resultado = await prisma.$transaction(async (tx) => {
      // Eliminar detalles anteriores
      await tx.detalle_factura.deleteMany({
        where: { id_factura: id }
      });

      // Crear nuevos detalles
      for (const detalle of detallesValidados) {
        await tx.detalle_factura.create({
          data: {
            id_factura: id,
            id_producto: detalle.id_producto,
            cantidad: detalle.cantidad,
            precio_unitario: detalle.precio_unitario,
            subtotal: detalle.subtotal
          }
        });
      }

      // Actualizar factura
      const facturaActualizada = await tx.factura.update({
        where: { id_factura: id },
        data: {
          subtotal: parseFloat(subtotal.toFixed(3)),
          total
        },
        include: {
          detalle_factura: {
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
        detalles: resultado.detalle_factura
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * F5.2 – Anular factura
 * POST /api/v1/facturas/:id/anular
 * Body: { motivo?: string }
 * 
 * REFACTORIZADO: Usa fn_anular_factura() de la BD
 */
export const anularFactura = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de factura es requerido',
        data: null
      });
    }

    // 🔷 LLAMAR FUNCIÓN DE BD: fn_anular_factura()
    const resultado = await prisma.$queryRaw`
      SELECT * FROM fn_anular_factura(
        ${id}::VARCHAR(20)
      )
    `;

    if (!resultado || resultado.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Error al anular factura',
        data: null
      });
    }

    const factura = resultado[0];

    // Validar si BD retornó error
    if (factura.error || factura.mensaje?.includes('Error')) {
      return res.status(400).json({
        status: 'error',
        message: factura.mensaje || 'Error al anular factura',
        data: null
      });
    }

    return res.json({
      status: 'success',
      message: 'Factura anulada correctamente',
      data: factura
    });
  } catch (err) {
    next(err);
  }
};

/**
 * F5.5 – Datos para impresión de factura
 * GET /api/v1/facturas/:id/imprimir
 */
export const imprimirFactura = async (req, res, next) => {
  try {
    const { id } = req.params;

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
        iva: true,
        sucursal: {
          include: { ciudad: true }
        },
        metodo_pago: true,
        canal_venta: true
      }
    });

    if (!factura) {
      return res.status(404).json({
        status: 'error',
        message: 'La factura no existe',
        data: null
      });
    }

    const subtotalNum = parseFloat(factura.subtotal);
    const totalNum = parseFloat(factura.total);
    const valorIva = totalNum - subtotalNum;

    const datosImpresion = {
      // Encabezado
      numero_factura: factura.id_factura,
      fecha_emision: factura.fecha_emision,
      estado: factura.estado,
      estado_texto: {
        'EMI': 'EMITIDA',
        'ANU': 'ANULADA',
        'PAG': 'PAGADA'
      }[factura.estado] || factura.estado,
      canal: factura.canal_venta.descripcion,

      // Cliente
      cliente: {
        identificacion: factura.cliente.ruc_cedula,
        nombre_completo: [
          factura.cliente.nombre1,
          factura.cliente.nombre2,
          factura.cliente.apellido1,
          factura.cliente.apellido2
        ].filter(Boolean).join(' '),
        direccion: factura.cliente.direccion,
        telefono: factura.cliente.telefono,
        email: factura.cliente.email,
        ciudad: factura.cliente.ciudad?.descripcion
      },

      // Sucursal
      sucursal: {
        nombre: factura.sucursal.nombre,
        direccion: factura.sucursal.direccion,
        telefono: factura.sucursal.telefono,
        ciudad: factura.sucursal.ciudad?.descripcion
      },

      // Método de pago
      metodo_pago: factura.metodo_pago.nombre,

      // Detalles
      detalles: factura.detalle_factura.map((d, idx) => ({
        linea: idx + 1,
        codigo: d.id_producto,
        descripcion: d.producto.descripcion,
        cantidad: d.cantidad,
        precio_unitario: parseFloat(d.precio_unitario),
        subtotal: parseFloat(d.subtotal)
      })),

      // Totales
      subtotal: subtotalNum,
      porcentaje_iva: parseFloat(factura.iva.porcentaje),
      valor_iva: parseFloat(valorIva.toFixed(3)),
      total: totalNum,

      // Marca de agua si está anulada
      marca_agua: factura.estado === 'ANU' ? 'ANULADA' : null
    };

    return res.json({
      status: 'success',
      message: 'Datos de impresión obtenidos',
      data: datosImpresion
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/facturas/cliente/:id_cliente
 * Obtener facturas de un cliente específico
 */
export const facturasCliente = async (req, res, next) => {
  try {
    const { id_cliente } = req.params;

    const facturas = await prisma.factura.findMany({
      where: { id_cliente: Number(id_cliente) },
      include: {
        detalle_factura: {
          include: { producto: true }
        },
        sucursal: true,
        metodo_pago: true
      },
      orderBy: { fecha_emision: 'desc' }
    });

    return res.json({
      status: 'success',
      message: 'Facturas del cliente obtenidas',
      data: facturas
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/facturas/mis-pedidos
 * Obtener historial de pedidos del cliente autenticado
 * Requiere autenticación - el id_cliente viene del token JWT
 */
export const misPedidos = async (req, res, next) => {
  try {
    const id_cliente = req.usuario?.id_cliente;

    if (!id_cliente) {
      return res.status(403).json({
        status: 'error',
        message: 'No tiene permisos para acceder a este recurso',
        data: null
      });
    }

    const facturas = await prisma.factura.findMany({
      where: { 
        id_cliente: id_cliente,
        id_canal: 'WEB' // Solo pedidos del e-commerce
      },
      include: {
        detalle_factura: {
          include: { 
            producto: {
              select: {
                id_producto: true,
                descripcion: true,
                imagen_url: true,
                marca: {
                  select: {
                    nombre: true
                  }
                }
              }
            }
          }
        },
        sucursal: {
          select: {
            id_sucursal: true,
            nombre: true,
            direccion: true,
            telefono: true,
            horario: true
          }
        },
        metodo_pago: {
          select: {
            nombre: true
          }
        }
      },
      orderBy: { fecha_emision: 'desc' }
    });

    // Formatear respuesta para mejor UX en frontend
    const pedidosFormateados = facturas.map(factura => ({
      id_factura: factura.id_factura,
      fecha_emision: factura.fecha_emision,
      subtotal: parseFloat(factura.subtotal),
      total: parseFloat(factura.total),
      estado: factura.estado,
      estado_texto: {
        'EMI': 'Emitida',
        'ANU': 'Anulada',
        'PAG': 'Pagada',
        'ENT': 'Entregada'
      }[factura.estado] || factura.estado,
      puede_anular: factura.estado === 'EMI', // Solo emitidas se pueden anular
      metodo_pago: factura.metodo_pago.nombre,
      punto_retiro: factura.sucursal,
      productos: factura.detalle_factura.map(d => ({
        id_producto: d.id_producto,
        descripcion: d.producto.descripcion,
        marca: d.producto.marca?.nombre,
        imagen_url: d.producto.imagen_url,
        cantidad: d.cantidad,
        precio_unitario: parseFloat(d.precio_unitario),
        subtotal: parseFloat(d.subtotal)
      })),
      cantidad_items: factura.detalle_factura.length
    }));

    return res.json({
      status: 'success',
      message: 'Historial de pedidos obtenido',
      data: pedidosFormateados,
      total_pedidos: pedidosFormateados.length
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/facturas/pedidos-retiro?id_sucursal=1
 * Listar pedidos pendientes de retiro del e-commerce
 * Para uso en POS - permite al cajero ver pedidos a retirar
 */
export const pedidosPendientesRetiro = async (req, res, next) => {
  try {
    const { id_sucursal } = req.query;
    const id_empleado = req.usuario?.id_empleado;

    // Si no se especifica sucursal, usar la del empleado
    let sucursalFiltro = id_sucursal ? Number(id_sucursal) : null;
    
    if (!sucursalFiltro && id_empleado) {
      const empleado = await prisma.empleado.findUnique({
        where: { id_empleado },
        select: { id_sucursal: true }
      });
      sucursalFiltro = empleado?.id_sucursal;
    }

    if (!sucursalFiltro) {
      return res.status(400).json({
        status: 'error',
        message: 'No se pudo determinar la sucursal',
        data: null
      });
    }

    // Buscar facturas de e-commerce pendientes de retiro
    const pedidos = await prisma.factura.findMany({
      where: {
        id_canal: 'WEB',
        id_sucursal: sucursalFiltro,
        estado: 'EMI', // Emitidas, pendientes de entrega
        fecha_retiro: null // Aún no retiradas
      },
      include: {
        cliente: {
          select: {
            id_cliente: true,
            nombre1: true,
            nombre2: true,
            apellido1: true,
            apellido2: true,
            ruc_cedula: true,
            telefono: true
          }
        },
        detalle_factura: {
          include: {
            producto: {
              select: {
                id_producto: true,
                descripcion: true,
                marca: {
                  select: { nombre: true }
                }
              }
            }
          }
        },
        metodo_pago: {
          select: { nombre: true }
        }
      },
      orderBy: { fecha_emision: 'asc' } // Más antiguos primero
    });

    // Formatear para mejor UX en POS
    const pedidosFormateados = pedidos.map(pedido => ({
      id_factura: pedido.id_factura,
      fecha_emision: pedido.fecha_emision,
      cliente: {
        id_cliente: pedido.cliente.id_cliente,
        nombre_completo: [
          pedido.cliente.nombre1,
          pedido.cliente.nombre2,
          pedido.cliente.apellido1,
          pedido.cliente.apellido2
        ].filter(Boolean).join(' '),
        ruc_cedula: pedido.cliente.ruc_cedula,
        telefono: pedido.cliente.telefono
      },
      total: parseFloat(pedido.total),
      metodo_pago: pedido.metodo_pago.nombre,
      cantidad_items: pedido.detalle_factura.length,
      productos: pedido.detalle_factura.map(d => ({
        descripcion: d.producto.descripcion,
        marca: d.producto.marca?.nombre,
        cantidad: d.cantidad
      }))
    }));

    return res.json({
      status: 'success',
      message: 'Pedidos pendientes de retiro',
      data: pedidosFormateados,
      total_pendientes: pedidosFormateados.length
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/facturas/:id/marcar-retirado
 * Marcar un pedido como retirado
 * Actualiza fecha_retiro y opcionalmente cambia estado
 */
export const marcarRetirado = async (req, res, next) => {
  try {
    const { id } = req.params;

    const factura = await prisma.factura.findUnique({
      where: { id_factura: id }
    });

    if (!factura) {
      return res.status(404).json({
        status: 'error',
        message: 'Factura no encontrada',
        data: null
      });
    }

    if (factura.id_canal !== 'WEB') {
      return res.status(400).json({
        status: 'error',
        message: 'Solo se pueden marcar como retirados los pedidos del e-commerce',
        data: null
      });
    }

    if (factura.fecha_retiro) {
      return res.status(400).json({
        status: 'error',
        message: 'Este pedido ya fue retirado',
        data: { fecha_retiro: factura.fecha_retiro }
      });
    }

    const facturaActualizada = await prisma.factura.update({
      where: { id_factura: id },
      data: {
        fecha_retiro: new Date()
      }
    });

    return res.json({
      status: 'success',
      message: 'Pedido marcado como retirado',
      data: {
        id_factura: facturaActualizada.id_factura,
        fecha_retiro: facturaActualizada.fecha_retiro
      }
    });
  } catch (err) {
    next(err);
  }
};

export default {
  listarFacturas,
  buscarFacturas,
  crearFactura,
  editarFacturaAbierta,
  anularFactura,
  imprimirFactura,
  facturasCliente,
  misPedidos,
  pedidosPendientesRetiro,
  marcarRetirado
};