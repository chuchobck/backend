// src/controllers/compra.controller.js
// 🔵 PERSONA 1: Módulo F2 - Gestión de Órdenes de Compra

import prisma from '../lib/prisma.js';

/**
 * GET /api/v1/compras
 * F2.4.1 - Consulta general de órdenes de compra
 */
export const listarCompras = async (req, res, next) => {
  try {
    const compras = await prisma.compra.findMany({
      include: {
        proveedor: true,
        detalles: {
          include: { producto: true }
        }
      },
      orderBy: { fecha_creacion: 'desc' }
    });

    return res.json({
      status: 'success',
      message: 'Órdenes de compra obtenidas',
      data: compras
    });
  } catch (err) {
    // E1: Desconexión
    next(err);
  }
};

/**
 * GET /api/v1/compras/:id
 * Obtener orden de compra con detalle
 */
export const obtenerCompra = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID inválido',
        data: null
      });
    }

    const compra = await prisma.compra.findUnique({
      where: { id_compra: id },
      include: {
        proveedor: true,
        detalles: {
          include: { producto: true }
        }
      }
    });

    // E2: Orden inexistente
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

    // E5: Parámetros faltantes
    if (!proveedor && !fechaDesde && !fechaHasta && !estado) {
      return res.status(400).json({
        status: 'error',
        message: 'Ingrese al menos un criterio de búsqueda',
        data: null
      });
    }

    const compras = await prisma.compra.findMany({
      where: {
        AND: [
          proveedor ? { proveedorId: Number(proveedor) } : {},
          estado ? { estado } : {},
          fechaDesde ? { fecha_creacion: { gte: new Date(fechaDesde) } } : {},
          fechaHasta ? { fecha_creacion: { lte: new Date(fechaHasta) } } : {}
        ]
      },
      include: { proveedor: true }
    });

    // E6: Sin resultados
    if (compras.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron órdenes de compra',
        data: []
      });
    }

    return res.json({
      status: 'success',
      message: 'Búsqueda completada',
      data: compras
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/compras
 * F2.1 - Ingreso de orden de compra
 * Crea la orden sin stored procedures
 */
export const crearCompra = async (req, res, next) => {
  try {
    const { proveedorId, detalles } = req.body;

    // E5: Datos obligatorios
    if (!proveedorId || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Proveedor y al menos un producto son requeridos',
        data: null
      });
    }

    // Validación básica de detalles
    for (const item of detalles) {
      if (!item.productoId) {
        return res.status(400).json({
          status: 'error',
          message: 'Producto inexistente',
          data: null
        });
      }

      if (!item.cantidad || item.cantidad <= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Cantidad incorrecta',
          data: null
        });
      }
    }

    // 1. Validar que el proveedor existe y está activo
    const proveedor = await prisma.proveedor.findUnique({
      where: { id_proveedor: Number(proveedorId) }
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

    // 2. Validar productos y obtener costo unitario
    const productosValidados = [];
    for (const item of detalles) {
      const producto = await prisma.producto.findUnique({
        where: { id_producto: item.productoId }
      });

      if (!producto) {
        return res.status(404).json({
          status: 'error',
          message: `El producto ${item.productoId} no existe`,
          data: null
        });
      }

      if (item.costo_unitario === undefined || item.costo_unitario <= 0) {
        return res.status(400).json({
          status: 'error',
          message: `Costo unitario inválido para producto ${item.productoId}`,
          data: null
        });
      }

      productosValidados.push({
        ...item,
        costo_unitario: Number(item.costo_unitario),
        cantidad: Number(item.cantidad)
      });
    }

    // 3. Obtener el IVA actual (fecha_fin = null)
    const iva = await prisma.iva.findFirst({
      where: { fecha_fin: null }
    });

    if (!iva) {
      return res.status(500).json({
        status: 'error',
        message: 'No existe un porcentaje de IVA configurado',
        data: null
      });
    }

    const porcentajeIVA = Number(iva.porcentaje) / 100;

    // 4. Calcular subtotales e IVA para cada detalle
    let subtotal_total = 0;
    const detallesConCalculos = productosValidados.map((item) => {
      const subtotal = item.cantidad * item.costo_unitario;
      const iva_detalle = subtotal * porcentajeIVA;
      subtotal_total += subtotal;

      return {
        ...item,
        subtotal,
        iva_detalle
      };
    });

    // Calcular totales
    const iva_total = subtotal_total * porcentajeIVA;
    const total = subtotal_total + iva_total;

    // 5. Usar transacción para crear orden y detalles
    const resultado = await prisma.$transaction(async (tx) => {
      // Generar ID correlativo (COM#### donde #### es el siguiente número)
      const ultimaCompra = await tx.compra.findFirst({
        orderBy: { id_compra: 'desc' },
        select: { id_compra: true }
      });

      let siguienteNumero = 1;
      if (ultimaCompra && ultimaCompra.id_compra) {
        // Extraer el número de la última compra (ej: COM0001 -> 1)
        const matches = ultimaCompra.id_compra.match(/\d+/);
        if (matches) {
          siguienteNumero = parseInt(matches[0]) + 1;
        }
      }

      const id_compra = `COM${String(siguienteNumero).padStart(4, '0')}`;

      // Crear la orden de compra
      const compra = await tx.compra.create({
        data: {
          id_compra,
          proveedorId: Number(proveedorId),
          subtotal_total: parseFloat(subtotal_total.toFixed(2)),
          iva_total: parseFloat(iva_total.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          estado: 'PEN', // Pendiente
          ivaId: iva.id_iva
        }
      });

      // Crear detalles de la compra
      for (const detalle of detallesConCalculos) {
        await tx.detalle_compra.create({
          data: {
            id_compra: compra.id_compra,
            id_producto: detalle.productoId,
            cantidad: detalle.cantidad,
            costo_unitario: parseFloat(detalle.costo_unitario.toFixed(2)),
            subtotal: parseFloat(detalle.subtotal.toFixed(2)),
            iva: parseFloat(detalle.iva_detalle.toFixed(2))
          }
        });
      }

      return compra;
    });

    return res.status(201).json({
      status: 'success',
      message: 'Orden de compra creada correctamente',
      data: {
        id_compra: resultado.id_compra,
        subtotal_total: resultado.subtotal_total,
        iva_total: resultado.iva_total,
        total: resultado.total,
        estado: resultado.estado
      }
    });
  } catch (err) {
    // E1: Desconexión
    next(err);
  }
};

/**
 * PUT /api/v1/compras/:id
 * F2.2 - Actualización de orden de compra
 * Actualiza los detalles y recalcula totales
 */
export const actualizarCompra = async (req, res, next) => {
  try {
    const id_compra = req.params.id; // VARCHAR
    const { detalles } = req.body;

    // Validación de entrada
    if (!id_compra) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de compra es requerido',
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

    // Validación básica de detalles
    for (const item of detalles) {
      if (!item.productoId) {
        return res.status(400).json({
          status: 'error',
          message: 'Producto inexistente',
          data: null
        });
      }

      if (!item.cantidad || item.cantidad <= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Cantidad incorrecta',
          data: null
        });
      }

      if (item.costo_unitario === undefined || item.costo_unitario <= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Costo unitario inválido',
          data: null
        });
      }
    }

    // 1. Validar que la compra existe y estado = 'PEN'
    const compra = await prisma.compra.findUnique({
      where: { id_compra }
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
        message: 'Solo se pueden modificar órdenes con estado pendiente',
        data: null
      });
    }

    // 2. Validar todos los productos
    const productosValidados = [];
    for (const item of detalles) {
      const producto = await prisma.producto.findUnique({
        where: { id_producto: item.productoId }
      });

      if (!producto) {
        return res.status(404).json({
          status: 'error',
          message: `El producto ${item.productoId} no existe`,
          data: null
        });
      }

      productosValidados.push({
        ...item,
        costo_unitario: Number(item.costo_unitario),
        cantidad: Number(item.cantidad)
      });
    }

    // 3. Obtener el IVA actual
    const iva = await prisma.iva.findFirst({
      where: { fecha_fin: null }
    });

    if (!iva) {
      return res.status(500).json({
        status: 'error',
        message: 'No existe un porcentaje de IVA configurado',
        data: null
      });
    }

    const porcentajeIVA = Number(iva.porcentaje) / 100;

    // Calcular nuevos totales
    let subtotal_total = 0;
    const detallesConCalculos = productosValidados.map((item) => {
      const subtotal = item.cantidad * item.costo_unitario;
      const iva_detalle = subtotal * porcentajeIVA;
      subtotal_total += subtotal;

      return {
        ...item,
        subtotal,
        iva_detalle
      };
    });

    const iva_total = subtotal_total * porcentajeIVA;
    const total = subtotal_total + iva_total;

    // 3. Usar transacción para actualizar
    const resultado = await prisma.$transaction(async (tx) => {
      // a. Marcar detalles anteriores como inactivos (eliminación lógica)
      await tx.detalle_compra.updateMany({
        where: { id_compra },
        data: { estado: 'INA' }
      });

      // b. Insertar los nuevos detalles
      for (const detalle of detallesConCalculos) {
        await tx.detalle_compra.create({
          data: {
            id_compra,
            id_producto: detalle.productoId,
            cantidad: detalle.cantidad,
            costo_unitario: parseFloat(detalle.costo_unitario.toFixed(2)),
            subtotal: parseFloat(detalle.subtotal.toFixed(2)),
            iva: parseFloat(detalle.iva_detalle.toFixed(2))
          }
        });
      }

      // c. y d. Actualizar la cabecera de compra (sin cambiar el estado)
      const compraActualizada = await tx.compra.update({
        where: { id_compra },
        data: {
          subtotal_total: parseFloat(subtotal_total.toFixed(2)),
          iva_total: parseFloat(iva_total.toFixed(2)),
          total: parseFloat(total.toFixed(2))
          // estado sigue siendo 'PEN'
        },
        include: {
          detalles: {
            include: { producto: true }
          }
        }
      });

      return compraActualizada;
    });

    return res.json({
      status: 'success',
      message: 'Orden de compra actualizada correctamente',
      data: {
        id_compra: resultado.id_compra,
        subtotal_total: resultado.subtotal_total,
        iva_total: resultado.iva_total,
        total: resultado.total,
        estado: resultado.estado,
        detalles: resultado.detalles
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/compras/:id
 * F2.3 - Anulación de orden de compra
 * Solo permite anular si no tiene recepciones asociadas
 */
export const anularCompra = async (req, res, next) => {
  try {
    const id_compra = req.params.id; // VARCHAR

    if (!id_compra) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de compra es requerido',
        data: null
      });
    }

    // 1. Validar que la compra existe
    const compra = await prisma.compra.findUnique({
      where: { id_compra }
    });

    if (!compra) {
      return res.status(404).json({
        status: 'error',
        message: 'La orden de compra no existe',
        data: null
      });
    }

    // 2. Validar que NO está ya anulada
    if (compra.estado === 'ANU') {
      return res.status(409).json({
        status: 'error',
        message: 'La orden ya se encuentra anulada',
        data: null
      });
    }

    // 3. Validar que NO tiene recepciones asociadas
    const recepciones = await prisma.recepcion.findMany({
      where: { id_compra }
    });

    if (recepciones.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'No se puede anular una orden con recepciones',
        data: null
      });
    }

    // 4. Actualizar estado a 'ANU'
    const compraAnulada = await prisma.compra.update({
      where: { id_compra },
      data: { estado: 'ANU' }
    });

    return res.json({
      status: 'success',
      message: 'Orden de compra anulada correctamente',
      data: {
        id_compra: compraAnulada.id_compra,
        estado: compraAnulada.estado
      }
    });
  } catch (err) {
    next(err);
  }
};
