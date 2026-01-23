// src/controllers/compra.controller.js
// 🔵 PERSONA 1: Módulo F2 - Gestión de Órdenes de Compra

import prisma from '../lib/prisma.js';

/**
 * Validar formato de fecha
 */
function validarFecha(fecha) {
  const date = new Date(fecha);
  return !isNaN(date.getTime());
}

/**
 * Validar que no haya productos duplicados
 */
function validarDetallesSinDuplicados(detalles) {
  const productosVistos = new Set();
  for (const item of detalles) {
    if (productosVistos.has(item.id_producto)) {
      return { valido: false, producto: item.id_producto };
    }
    productosVistos.add(item.id_producto);
  }
  return { valido: true };
}

/**
 * GET /api/v1/compras
 * F2.4.1 - Consulta general de órdenes de compra
 */
export const listarCompras = async (req, res, next) => {
  try {
    const compras = await prisma.compra.findMany({
      include: {
        proveedor: {
          select: {
            id_proveedor: true,
            razon_social: true,
            ruc_cedula: true,
            estado: true
          }
        },
        detalle_compra: {
          include: { 
            producto: {
              select: {
                id_producto: true,
                descripcion: true,
                codigo_barras: true,
                estado: true
              }
            }
          }
        },
        _count: {
          select: {
            recepcion: true
          }
        }
      },
      orderBy: { fecha: 'desc' }
    });

    return res.json({
      status: 'success',
      message: `${compras.length} órdenes de compra encontradas`,
      data: compras
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/compras/:id
 * Obtener orden de compra con detalle
 */
export const obtenerCompra = async (req, res, next) => {
  try {
    const id = req.params.id;

    if (!id || id.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de compra inválido',
        data: null
      });
    }

    const compra = await prisma.compra.findUnique({
      where: { id_compra: id },
      include: {
        proveedor: true,
        detalle_compra: {
          include: { 
            producto: {
              include: {
                marca: true,
                categoria_producto: true
              }
            }
          },
          orderBy: { id_producto: 'asc' }
        },
        _count: {
          select: {
            recepcion: true
          }
        }
      }
    });

    if (!compra) {
      return res.status(404).json({
        status: 'error',
        message: 'La orden de compra no existe',
        data: null
      });
    }

    return res.json({
      status: 'success',
      message: 'Orden de compra obtenida',
      data: compra
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/compras/buscar
 * F2.4.2 - Consulta de órdenes por parámetros
 */
export const buscarCompras = async (req, res, next) => {
  try {
    const { proveedor, fechaDesde, fechaHasta, estado } = req.query;

    if (!proveedor && !fechaDesde && !fechaHasta && !estado) {
      return res.status(400).json({
        status: 'error',
        message: 'Ingrese al menos un criterio de búsqueda (proveedor, fechaDesde, fechaHasta, estado)',
        data: null
      });
    }

    const whereConditions = {};

    // Validar proveedor
    if (proveedor) {
      whereConditions.id_proveedor = proveedor.trim();
    }

    // Validar estado
    if (estado) {
      const estadosValidos = ['PEN', 'COM', 'ANU'];
      if (!estadosValidos.includes(estado)) {
        return res.status(400).json({
          status: 'error',
          message: 'Estado inválido. Use "PEN" (Pendiente), "COM" (Completada), o "ANU" (Anulada)',
          data: null
        });
      }
      whereConditions.estado = estado;
    }

    // Validar fechas
    if (fechaDesde) {
      if (!validarFecha(fechaDesde)) {
        return res.status(400).json({
          status: 'error',
          message: 'Formato de fechaDesde inválido. Use formato ISO (YYYY-MM-DD)',
          data: null
        });
      }
      whereConditions.fecha = { 
        ...whereConditions.fecha,
        gte: new Date(fechaDesde) 
      };
    }

    if (fechaHasta) {
      if (!validarFecha(fechaHasta)) {
        return res.status(400).json({
          status: 'error',
          message: 'Formato de fechaHasta inválido. Use formato ISO (YYYY-MM-DD)',
          data: null
        });
      }
      whereConditions.fecha = { 
        ...whereConditions.fecha,
        lte: new Date(fechaHasta) 
      };
    }

    // Validar coherencia de fechas
    if (fechaDesde && fechaHasta) {
      const desde = new Date(fechaDesde);
      const hasta = new Date(fechaHasta);
      if (desde > hasta) {
        return res.status(400).json({
          status: 'error',
          message: 'fechaDesde no puede ser posterior a fechaHasta',
          data: null
        });
      }
    }

    const compras = await prisma.compra.findMany({
      where: whereConditions,
      include: { 
        proveedor: {
          select: {
            id_proveedor: true,
            razon_social: true,
            ruc_cedula: true
          }
        },
        _count: {
          select: {
            detalle_compra: true,
            recepcion: true
          }
        }
      },
      orderBy: { fecha: 'desc' }
    });

    if (compras.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron órdenes de compra con los criterios especificados',
        data: []
      });
    }

    return res.json({
      status: 'success',
      message: `${compras.length} orden(es) de compra encontrada(s)`,
      data: compras
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/compras
 * F2.1 - Ingreso de orden de compra
 */
export const crearCompra = async (req, res, next) => {
  try {
    const { id_proveedor, detalles } = req.body;

    // Validar datos obligatorios
    if (!id_proveedor || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'id_proveedor y al menos un producto son requeridos',
        data: null
      });
    }

    // Validar que no haya duplicados
    const validacionDuplicados = validarDetallesSinDuplicados(detalles);
    if (!validacionDuplicados.valido) {
      return res.status(400).json({
        status: 'error',
        message: `El producto ${validacionDuplicados.producto} está duplicado en los detalles`,
        data: null
      });
    }

    // Validación básica de detalles
    for (const item of detalles) {
      if (!item.id_producto || item.id_producto.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'id_producto es requerido en todos los detalles',
          data: null
        });
      }

      if (!item.cantidad || item.cantidad <= 0) {
        return res.status(400).json({
          status: 'error',
          message: `Cantidad inválida para producto ${item.id_producto}. Debe ser mayor a 0`,
          data: null
        });
      }

      // Validar cantidad máxima razonable
      if (item.cantidad > 999999) {
        return res.status(400).json({
          status: 'error',
          message: `Cantidad excesiva para producto ${item.id_producto}. Máximo 999,999 unidades`,
          data: null
        });
      }

      if (!item.costo_unitario || item.costo_unitario <= 0) {
        return res.status(400).json({
          status: 'error',
          message: `Costo unitario inválido para producto ${item.id_producto}. Debe ser mayor a 0`,
          data: null
        });
      }

      // Validar costo máximo razonable
      if (item.costo_unitario > 999999.999) {
        return res.status(400).json({
          status: 'error',
          message: `Costo unitario excesivo para producto ${item.id_producto}`,
          data: null
        });
      }
    }

    // Validar que el proveedor existe y está activo
    const proveedor = await prisma.proveedor.findUnique({
      where: { id_proveedor: id_proveedor.trim() }
    });

    if (!proveedor) {
      return res.status(404).json({
        status: 'error',
        message: 'El proveedor no existe',
        data: null
      });
    }

    if (proveedor.estado !== 'ACT') {
      return res.status(400).json({
        status: 'error',
        message: 'El proveedor no está activo',
        data: null
      });
    }

    // Validar productos y preparar detalles
    const productosValidados = [];
    for (const item of detalles) {
      const producto = await prisma.producto.findUnique({
        where: { id_producto: item.id_producto.trim() }
      });

      if (!producto) {
        return res.status(404).json({
          status: 'error',
          message: `El producto ${item.id_producto} no existe`,
          data: null
        });
      }

      if (producto.estado !== 'ACT') {
        return res.status(400).json({
          status: 'error',
          message: `El producto ${item.id_producto} no está activo`,
          data: null
        });
      }

      productosValidados.push({
        id_producto: item.id_producto.trim(),
        costo_unitario: parseFloat(item.costo_unitario),
        cantidad: parseInt(item.cantidad)
      });
    }

    // Calcular subtotales y total
    let subtotalTotal = 0;
    const detallesConCalculos = productosValidados.map((item) => {
      const subtotal = item.cantidad * item.costo_unitario;
      subtotalTotal += subtotal;

      return {
        ...item,
        subtotal: parseFloat(subtotal.toFixed(3))
      };
    });

    const total = parseFloat(subtotalTotal.toFixed(3));

    // Usar transacción para crear orden y detalles
    const resultado = await prisma.$transaction(async (tx) => {
      // Crear la orden de compra
      const compra = await tx.compra.create({
        data: {
          id_proveedor: id_proveedor.trim(),
          subtotal: subtotalTotal,
          total: total,
          estado: 'PEN'
        }
      });

      // Crear detalles de la compra
      for (const detalle of detallesConCalculos) {
        await tx.detalle_compra.create({
          data: {
            id_compra: compra.id_compra,
            id_producto: detalle.id_producto,
            cantidad: detalle.cantidad,
            costo_unitario: detalle.costo_unitario,
            subtotal: detalle.subtotal
          }
        });
      }

      // Retornar compra completa con detalles
      return await tx.compra.findUnique({
        where: { id_compra: compra.id_compra },
        include: {
          proveedor: true,
          detalle_compra: {
            include: { 
              producto: {
                select: {
                  id_producto: true,
                  descripcion: true,
                  codigo_barras: true
                }
              }
            }
          }
        }
      });
    });

    return res.status(201).json({
      status: 'success',
      message: 'Orden de compra creada correctamente',
      data: resultado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/compras/:id
 * F2.2 - Actualización de orden de compra
 */
export const actualizarCompra = async (req, res, next) => {
  try {
    const id_compra = req.params.id;
    const { detalles } = req.body;

    // Validación de entrada
    if (!id_compra || id_compra.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de compra inválido',
        data: null
      });
    }

    if (!Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Al menos un producto es requerido',
        data: null
      });
    }
 
    // Validar que no haya duplicados
    const validacionDuplicados = validarDetallesSinDuplicados(detalles);
    if (!validacionDuplicados.valido) {
      return res.status(400).json({
        status: 'error',
        message: `El producto ${validacionDuplicados.producto} está duplicado en los detalles`,
        data: null
      });
    }

    // Validación básica de detalles
    for (const item of detalles) {
      if (!item.id_producto || item.id_producto.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'id_producto es requerido en todos los detalles',
          data: null
        });
      }

      if (!item.cantidad || item.cantidad <= 0) {
        return res.status(400).json({
          status: 'error',
          message: `Cantidad inválida para producto ${item.id_producto}`,
          data: null
        });
      }

      if (item.cantidad > 999999) {
        return res.status(400).json({
          status: 'error',
          message: `Cantidad excesiva para producto ${item.id_producto}`,
          data: null
        });
      }

      if (!item.costo_unitario || item.costo_unitario <= 0) {
        return res.status(400).json({
          status: 'error',
          message: `Costo unitario inválido para producto ${item.id_producto}`,
          data: null
        });
      }

      if (item.costo_unitario > 999999.999) {
        return res.status(400).json({
          status: 'error',
          message: `Costo unitario excesivo para producto ${item.id_producto}`,
          data: null
        });
      }
    }

    // Validar que la compra existe
    const compra = await prisma.compra.findUnique({
      where: { id_compra: id_compra.trim() },
      include: {
        _count: {
          select: {
            recepcion: true
          }
        }
      }
    });

    if (!compra) {
      return res.status(404).json({
        status: 'error',
        message: 'La orden de compra no existe',
        data: null
      });
    }

    if (compra.estado !== 'PEN') {
      return res.status(409).json({
        status: 'error',
        message: `No se pueden modificar órdenes con estado ${compra.estado}. Solo se permiten modificaciones en estado PEN (Pendiente)`,
        data: null
      });
    }

    // Advertir si tiene recepciones (aunque esté pendiente)
    if (compra._count.recepcion > 0) {
      return res.status(409).json({
        status: 'error',
        message: `La orden tiene ${compra._count.recepcion} recepción(es) asociada(s). No se puede modificar`,
        data: null
      });
    }

    // Validar todos los productos
    const productosValidados = [];
    for (const item of detalles) {
      const producto = await prisma.producto.findUnique({
        where: { id_producto: item.id_producto.trim() }
      });

      if (!producto) {
        return res.status(404).json({
          status: 'error',
          message: `El producto ${item.id_producto} no existe`,
          data: null
        });
      }

      if (producto.estado !== 'ACT') {
        return res.status(400).json({
          status: 'error',
          message: `El producto ${item.id_producto} no está activo`,
          data: null
        });
      }

      productosValidados.push({
        id_producto: item.id_producto.trim(),
        costo_unitario: parseFloat(item.costo_unitario),
        cantidad: parseInt(item.cantidad)
      });
    }

    // Calcular nuevos totales
    let subtotalTotal = 0;
    const detallesConCalculos = productosValidados.map((item) => {
      const subtotal = item.cantidad * item.costo_unitario;
      subtotalTotal += subtotal;

      return {
        ...item,
        subtotal: parseFloat(subtotal.toFixed(3))
      };
    });

    const total = parseFloat(subtotalTotal.toFixed(3));

    // Usar transacción para actualizar
    const resultado = await prisma.$transaction(async (tx) => {
      // Eliminar detalles anteriores
      await tx.detalle_compra.deleteMany({
        where: { id_compra: id_compra.trim() }
      });

      // Insertar los nuevos detalles
      for (const detalle of detallesConCalculos) {
        await tx.detalle_compra.create({
          data: {
            id_compra: id_compra.trim(),
            id_producto: detalle.id_producto,
            cantidad: detalle.cantidad,
            costo_unitario: detalle.costo_unitario,
            subtotal: detalle.subtotal
          }
        });
      }

      // Actualizar la cabecera de compra
      const compraActualizada = await tx.compra.update({
        where: { id_compra: id_compra.trim() },
        data: {
          subtotal: subtotalTotal,
          total: total
        },
        include: {
          proveedor: true,
          detalle_compra: {
            include: { 
              producto: {
                select: {
                  id_producto: true,
                  descripcion: true,
                  codigo_barras: true
                }
              }
            }
          }
        }
      });

      return compraActualizada;
    });

    return res.json({
      status: 'success',
      message: 'Orden de compra actualizada correctamente',
      data: resultado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/compras/:id
 * F2.3 - Anulación de orden de compra
 */
export const anularCompra = async (req, res, next) => {
  try {
    const id_compra = req.params.id;

    if (!id_compra || id_compra.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de compra inválido',
        data: null
      });
    }

    // Validar que la compra existe
    const compra = await prisma.compra.findUnique({
      where: { id_compra: id_compra.trim() },
      include: {
        _count: {
          select: {
            recepcion: true
          }
        }
      }
    });

    if (!compra) {
      return res.status(404).json({
        status: 'error',
        message: 'La orden de compra no existe',
        data: null
      });
    }

    // Validar que NO está ya anulada
    if (compra.estado === 'ANU') {
      return res.status(400).json({
        status: 'error',
        message: 'La orden ya se encuentra anulada',
        data: null
      });
    }

    // Validar que NO tiene recepciones asociadas
    if (compra._count.recepcion > 0) {
      return res.status(409).json({
        status: 'error',
        message: `No se puede anular una orden con ${compra._count.recepcion} recepción(es) asociada(s)`,
        data: null
      });
    }

    // Actualizar estado a 'ANU'
    const compraAnulada = await prisma.compra.update({
      where: { id_compra: id_compra.trim() },
      data: { estado: 'ANU' },
      include: {
        proveedor: {
          select: {
            id_proveedor: true,
            razon_social: true
          }
        }
      }
    });

    return res.json({
      status: 'success',
      message: 'Orden de compra anulada correctamente',
      data: {
        id_compra: compraAnulada.id_compra,
        estado: compraAnulada.estado,
        proveedor: compraAnulada.proveedor
      }
    });
  } catch (err) {
    next(err);
  }
};
