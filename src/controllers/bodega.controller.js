// src/controllers/bodega.controller.js
// 🔵 PERSONA 1: Módulo F3 - Gestión de Bodega (Recepciones)

import prisma from '../lib/prisma.js';

/**
 * GET /api/v1/bodega/recepciones
 * F3.4.1 - Consulta general de bodega
 */
export const listarRecepciones = async (req, res, next) => {
  try {
    const recepciones = await prisma.recepcion.findMany({
      include: {
        compra: true,
        detalles: {
          include: { producto: true }
        }
      },
      orderBy: { fecha_recepcion: 'desc' }
    });

    return res.json({
      status: 'success',
      message: 'Recepciones obtenidas',
      data: recepciones
    });
  } catch (err) {
    // E1: Desconexión
    next(err);
  }
};

/**
 * GET /api/v1/bodega/recepciones/:id
 * Obtener recepción con detalle
 */
export const obtenerRecepcion = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID inválido',
        data: null
      });
    }

    const recepcion = await prisma.recepcion.findUnique({
      where: { id_recepcion: id },
      include: {
        compra: true,
        detalles: {
          include: { producto: true }
        }
      }
    });

    // E2: Ingreso inexistente
    if (!recepcion) {
      return res.status(404).json({
        status: 'error',
        message: 'No existe el ingreso de bodega',
        data: null
      });
    }

    return res.json({
      status: 'success',
      message: 'Recepción obtenida',
      data: recepcion
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/bodega/recepciones/buscar
 * F3.4.2 - Consulta de bodega por parámetros
 */
export const buscarRecepciones = async (req, res, next) => {
  try {
    const { compra, fechaDesde, fechaHasta } = req.query;

    // E5: Parámetros faltantes
    if (!compra && !fechaDesde && !fechaHasta) {
      return res.status(400).json({
        status: 'error',
        message: 'Ingrese al menos un criterio de búsqueda',
        data: null
      });
    }

    const recepciones = await prisma.recepcion.findMany({
      where: {
        AND: [
          compra ? { compraId: Number(compra) } : {},
          fechaDesde ? { fecha_recepcion: { gte: new Date(fechaDesde) } } : {},
          fechaHasta ? { fecha_recepcion: { lte: new Date(fechaHasta) } } : {}
        ]
      },
      include: { compra: true }
    });

    // E6: Sin resultados
    if (recepciones.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron ingresos de bodega',
        data: []
      });
    }

    return res.json({
      status: 'success',
      message: 'Búsqueda completada',
      data: recepciones
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/bodega/recepciones
 * F3.1 - Ingreso de bodega
 * Llama a: sp_recepcion_registrar ⭐ CRÍTICO
 */
export const registrarRecepcion = async (req, res, next) => {
  try {
    const { compraId, detalles } = req.body;

    // E6: Datos faltantes
    if (!compraId || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Orden de compra y productos son requeridos',
        data: null
      });
    }

    // Validar cantidades básicas
    for (const item of detalles) {
      if (!item.productoId || item.cantidad === undefined) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos incompletos en los productos',
          data: null
        });
      }

      if (item.cantidad <= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Cantidad incorrecta',
          data: null
        });
      }
    }

    // 1. Validar que la orden de compra existe
    const compra = await prisma.compra.findUnique({
      where: { id_compra: compraId },
      include: {
        detalles: true
      }
    });

    if (!compra) {
      return res.status(404).json({
        status: 'error',
        message: 'La orden de compra no existe',
        data: null
      });
    }

    // 2. Validar que la orden NO está anulada
    if (compra.estado === 'ANU') {
      return res.status(400).json({
        status: 'error',
        message: 'No se puede recibir una orden anulada',
        data: null
      });
    }

    // 3. Validar productos y cantidades
    const detallesValidados = [];
    for (const item of detalles) {
      // Validar que el producto existe en la orden de compra
      const detalleCompra = compra.detalles.find(d => d.id_producto === item.productoId);

      if (!detalleCompra) {
        return res.status(404).json({
          status: 'error',
          message: `El producto ${item.productoId} no existe en esta orden`,
          data: null
        });
      }

      // Validar cantidad_recibida no exceda (cantidad_solicitada - cantidad_ya_recibida)
      const cantidadPendiente = detalleCompra.cantidad - (detalleCompra.cantidad_recibida || 0);

      if (item.cantidad > cantidadPendiente) {
        return res.status(400).json({
          status: 'error',
          message: `Cantidad excede lo pendiente para producto ${item.productoId}. Pendiente: ${cantidadPendiente}`,
          data: null
        });
      }

      // Validar que el producto existe
      const producto = await prisma.producto.findUnique({
        where: { id_producto: item.productoId }
      });

      if (!producto) {
        return res.status(404).json({
          status: 'error',
          message: `El producto ${item.productoId} no existe en el sistema`,
          data: null
        });
      }

      detallesValidados.push({
        ...item,
        cantidad: Number(item.cantidad),
        detalleCompraId: detalleCompra.id_detalle_compra
      });
    }

    // 4. Obtener el empleado del req.usuario (si existe)
    const empleadoId = req.usuario?.id_empleado || null;

    // 5. Usar transacción para registrar recepción
    const resultado = await prisma.$transaction(async (tx) => {
      // a. Insertar en recepcion
      const recepcion = await tx.recepcion.create({
        data: {
          id_compra: compraId,
          id_empleado: empleadoId,
          descripcion: 'Recepción de mercadería',
          num_productos: detallesValidados.length,
          estado: 'ACT'
        }
      });

      // b. Para cada detalle: insertar en detalle_recepcion, actualizar cantidad_recibida y sumar ingresos
      let totalRecibido = 0;
      for (const detalle of detallesValidados) {
        // Insertar en detalle_recepcion
        await tx.detalle_recepcion.create({
          data: {
            id_recepcion: recepcion.id_recepcion,
            id_producto: detalle.productoId,
            cantidad: detalle.cantidad
          }
        });

        // Actualizar cantidad_recibida en detalle_compra
        await tx.detalle_compra.update({
          where: { id_detalle_compra: detalle.detalleCompraId },
          data: {
            cantidad_recibida: {
              increment: detalle.cantidad
            }
          }
        });

        // Incrementar campo 'ingresos' del producto
        await tx.producto.update({
          where: { id_producto: detalle.productoId },
          data: {
            ingresos: {
              increment: detalle.cantidad
            }
          }
        });

        totalRecibido += detalle.cantidad;
      }

      // c. Actualizar estado de la orden de compra
      // Obtener el estado actualizado de todos los detalles
      const detallesActualizados = await tx.detalle_compra.findMany({
        where: { id_compra: compraId }
      });

      let nuevoEstado = 'PEN'; // Por defecto pendiente

      // Verificar si todos están completos o si hay parciales
      const todosCompletos = detallesActualizados.every(
        d => d.cantidad_recibida >= d.cantidad
      );

      const algunoRecibido = detallesActualizados.some(
        d => d.cantidad_recibida > 0
      );

      if (todosCompletos) {
        nuevoEstado = 'CER'; // Cerrada
      } else if (algunoRecibido) {
        nuevoEstado = 'PAR'; // Parcial
      }

      // Actualizar la orden
      const compraActualizada = await tx.compra.update({
        where: { id_compra: compraId },
        data: { estado: nuevoEstado }
      });

      return { recepcion, compraActualizada };
    });

    return res.status(201).json({
      status: 'success',
      message: 'Ingreso de bodega registrado. Inventario actualizado.',
      data: {
        id_recepcion: resultado.recepcion.id_recepcion,
        id_compra: resultado.recepcion.id_compra,
        productos_recibidos: detallesValidados.length,
        nuevo_estado_orden: resultado.compraActualizada.estado
      }
    });
  } catch (err) {
    // E1: Desconexión
    next(err);
  }
};

/**
 * PUT /api/v1/bodega/recepciones/:id
 * F3.2 - Actualización de bodega
 * Llama a: sp_recepcion_modificar
 */
export const modificarRecepcion = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { detalles } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID inválido',
        data: null
      });
    }

    const recepcion = await prisma.recepcion.findUnique({
      where: { id_recepcion: id }
    });

    // E2: Ingreso inexistente
    if (!recepcion) {
      return res.status(404).json({
        status: 'error',
        message: 'No existe el ingreso de bodega',
        data: null
      });
    }

    // E3: Ingreso cerrado
    if (recepcion.estado === 'CER') {
      return res.status(409).json({
        status: 'error',
        message: 'El ingreso está cerrado y no puede modificarse',
        data: null
      });
    }

    // TODO:
    // E5: Validar cantidades
    // sp_recepcion_modificar:
    // 1. Revertir stock
    // 2. Aplicar nuevo stock
    // 3. Recalcular estado de la orden

    return res.json({
      status: 'success',
      message: 'Ingreso de bodega actualizado correctamente',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/bodega/recepciones/:id
 * F3.3 - Eliminación de bodega
 * Llama a: sp_recepcion_anular ⭐ CRÍTICO
 */
export const anularRecepcion = async (req, res, next) => {
  try {
    const id_recepcion = req.params.id;
    const { motivo_anulacion } = req.body;

    if (!id_recepcion) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de recepción es requerido',
        data: null
      });
    }

    // 1. Validar que la recepción existe
    const recepcion = await prisma.recepcion.findUnique({
      where: { id_recepcion: Number(id_recepcion) },
      include: {
        detalles: true,
        compra: {
          include: {
            detalles: true
          }
        }
      }
    });

    if (!recepcion) {
      return res.status(404).json({
        status: 'error',
        message: 'No existe el ingreso de bodega',
        data: null
      });
    }

    // 2. Validar que NO está ya anulada
    if (recepcion.estado === 'ANU') {
      return res.status(409).json({
        status: 'error',
        message: 'El ingreso ya se encuentra anulado',
        data: null
      });
    }

    // 3. Obtener todos los detalles de la recepción (ya están incluidos)
    // 4. Validar que al revertir el stock, ningún producto quedará en negativo
    for (const detalle of recepcion.detalles) {
      const producto = await prisma.producto.findUnique({
        where: { id_producto: detalle.id_producto },
        select: { ingresos: true }
      });

      if (!producto || producto.ingresos < detalle.cantidad) {
        return res.status(400).json({
          status: 'error',
          message: `No se puede revertir. Ingresos insuficientes para producto ${detalle.id_producto}`,
          data: null
        });
      }
    }

    // 5. Usar transacción para anular
    const resultado = await prisma.$transaction(async (tx) => {
      // a. Para cada detalle: decrementar ingresos y cantidad_recibida
      for (const detalle of recepcion.detalles) {
        // Decrementar 'ingresos' del producto
        await tx.producto.update({
          where: { id_producto: detalle.id_producto },
          data: {
            ingresos: {
              decrement: detalle.cantidad
            }
          }
        });

        // Encontrar el detalle_compra correspondiente y decrementar cantidad_recibida
        const detalleCompra = recepcion.compra.detalles.find(
          d => d.id_producto === detalle.id_producto
        );

        if (detalleCompra) {
          await tx.detalle_compra.update({
            where: { id_detalle_compra: detalleCompra.id_detalle_compra },
            data: {
              cantidad_recibida: {
                decrement: detalle.cantidad
              }
            }
          });
        }
      }

      // b. Actualizar recepción
      const recepcionAnulada = await tx.recepcion.update({
        where: { id_recepcion: Number(id_recepcion) },
        data: {
          estado: 'ANU',
          fecha_anulacion: new Date(),
          motivo_anulacion: motivo_anulacion || null
        }
      });

      // c. Recalcular estado de la orden
      const detallesActualizados = await tx.detalle_compra.findMany({
        where: { id_compra: recepcion.id_compra }
      });

      let nuevoEstado = 'PEN';

      const todosCompletos = detallesActualizados.every(
        d => d.cantidad_recibida >= d.cantidad
      );

      const algunoRecibido = detallesActualizados.some(
        d => d.cantidad_recibida > 0
      );

      if (todosCompletos) {
        nuevoEstado = 'CER';
      } else if (algunoRecibido) {
        nuevoEstado = 'PAR';
      }

      // Actualizar la orden
      const compraActualizada = await tx.compra.update({
        where: { id_compra: recepcion.id_compra },
        data: { estado: nuevoEstado }
      });

      return { recepcionAnulada, compraActualizada };
    });

    return res.json({
      status: 'success',
      message: 'Ingreso de bodega anulado. Inventario revertido.',
      data: {
        id_recepcion: resultado.recepcionAnulada.id_recepcion,
        estado: resultado.recepcionAnulada.estado,
        orden_compra_estado: resultado.compraActualizada.estado
      }
    });
  } catch (err) {
    next(err);
  }
};
