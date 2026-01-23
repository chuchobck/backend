// src/controllers/bodega.controller.js
// 🔵 Módulo F3 - Gestión de Bodega (Recepciones)

import prisma from '../lib/prisma.js';

/**
 * GET /api/v1/bodega/recepciones
 * F3.4.1 - Consulta general de recepciones
 */
export const listarRecepciones = async (req, res, next) => {
  try {
    const recepciones = await prisma.recepcion.findMany({
      include: {
        compra: {
          select: {
            id_compra: true,
            fecha: true,
            estado: true,
            proveedor: {
              select: {
                id_proveedor: true,
                razon_social: true
              }
            }
          }
        },
        detalle_recepcion: {
          include: { 
            producto: {
              select: {
                id_producto: true,
                descripcion: true,
                marca: {
                  select: {
                    nombre: true
                  }
                }
              }
            }
          }
        },
        empleado: {
          select: {
            id_empleado: true,
            nombre1: true,
            apellido1: true
          }
        }
      },
      orderBy: { fecha_hora: 'desc' }
    });

    return res.json({
      status: 'success',
      message: 'Recepciones obtenidas',
      data: recepciones
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/bodega/recepciones/:id
 * Obtener recepción con detalle completo
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
        compra: {
          include: {
            proveedor: true
          }
        },
        detalle_recepcion: {
          include: { 
            producto: {
              include: {
                marca: true
              }
            }
          }
        },
        empleado: {
          select: {
            id_empleado: true,
            nombre1: true,
            apellido1: true
          }
        }
      }
    });

    if (!recepcion) {
      return res.status(404).json({
        status: 'error',
        message: 'Recepción no encontrada',
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
 * F3.4.2 - Consulta de recepciones por parámetros
 * Query params: id_compra, estado, fechaDesde, fechaHasta
 */
export const buscarRecepciones = async (req, res, next) => {
  try {
    const { id_compra, estado, fechaDesde, fechaHasta } = req.query;

    // Validar que haya al menos un criterio
    if (!id_compra && !estado && !fechaDesde && !fechaHasta) {
      return res.status(400).json({
        status: 'error',
        message: 'Ingrese al menos un criterio de búsqueda',
        data: null
      });
    }

    // Construir filtros dinámicamente
    const whereClause = {};

    if (id_compra) {
      whereClause.id_compra = id_compra;
    }

    if (estado) {
      // Validar estados válidos
      const estadosValidos = ['ABI', 'APR', 'ANU'];
      if (!estadosValidos.includes(estado.toUpperCase())) {
        return res.status(400).json({
          status: 'error',
          message: 'Estado inválido. Valores permitidos: ABI, APR, ANU',
          data: null
        });
      }
      whereClause.estado = estado.toUpperCase();
    }

    if (fechaDesde || fechaHasta) {
      whereClause.fecha_hora = {};
      
      if (fechaDesde) {
        const fechaInicio = new Date(fechaDesde);
        fechaInicio.setHours(0, 0, 0, 0);
        whereClause.fecha_hora.gte = fechaInicio;
      }
      
      if (fechaHasta) {
        const fechaFin = new Date(fechaHasta);
        fechaFin.setHours(23, 59, 59, 999);
        whereClause.fecha_hora.lte = fechaFin;
      }
    }

    const recepciones = await prisma.recepcion.findMany({
      where: whereClause,
      include: {
        compra: {
          include: {
            proveedor: {
              select: {
                razon_social: true
              }
            }
          }
        },
        detalle_recepcion: {
          include: {
            producto: {
              select: {
                id_producto: true,
                descripcion: true
              }
            }
          }
        },
        empleado: {
          select: {
            nombre1: true,
            apellido1: true
          }
        }
      },
      orderBy: { fecha_hora: 'desc' }
    });

    if (recepciones.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron recepciones con los criterios especificados',
        data: []
      });
    }

    return res.json({
      status: 'success',
      message: 'Búsqueda completada',
      data: recepciones,
      total_resultados: recepciones.length
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/bodega/recepciones
 * F3.1 - Crear recepción desde una compra aprobada
 * Body: { id_compra, descripcion?, observaciones? }
 * 
 * REFACTORIZADO: Usa fn_ingresar_recepcion() de la BD
 * La función automáticamente crea detalle_recepcion con productos de detalle_compra
 */
export const registrarRecepcion = async (req, res, next) => {
  try {
    const { id_compra, descripcion, observaciones } = req.body;
    const id_empleado = req.usuario?.id_empleado || null;
    const id_usuario = req.usuario?.id_usuario || null;

    // Validación
    if (!id_compra) {
      return res.status(400).json({
        status: 'error',
        message: 'id_compra es requerido',
        data: null
      });
    }

    // 🔷 LLAMAR FUNCIÓN DE BD: fn_ingresar_recepcion()
    // La función crea automáticamente el detalle_recepcion con productos de la compra
    const resultado = await prisma.$queryRaw`
      SELECT * FROM fn_ingresar_recepcion(
        ${id_compra}::VARCHAR(7),
        ${id_empleado}::INTEGER,
        ${descripcion || null}::TEXT,
        ${observaciones || null}::TEXT,
        ${id_usuario}::INTEGER
      )
    `;

    if (!resultado || resultado.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Error al registrar recepción',
        data: null
      });
    }

    const recepcion = resultado[0];

    // Validar si BD retornó error
    if (!recepcion.resultado || recepcion.mensaje?.includes('ERROR')) {
      return res.status(400).json({
        status: 'error',
        message: recepcion.mensaje || 'Error al registrar recepción',
        data: null
      });
    }

    return res.status(201).json({
      status: 'success',
      message: 'Recepción creada exitosamente',
      data: {
        id_recepcion: recepcion.id_recepcion_generada,
        mensaje: recepcion.mensaje
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/bodega/recepciones/:id
 * F3.2.1 - Modificar cantidades de una recepción (solo estado ABI)
 * Body: { detalles: [{ id_producto, cantidad_recibida }] }
 */
export const modificarRecepcion = async (req, res, next) => {
  try {
    const id_recepcion = Number(req.params.id);
    const { detalles } = req.body;

    if (isNaN(id_recepcion)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID inválido',
        data: null
      });
    }

    if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Debe proporcionar al menos un detalle',
        data: null
      });
    }

    // Verificar que la recepción existe
    const recepcion = await prisma.recepcion.findUnique({
      where: { id_recepcion }
    });

    if (!recepcion) {
      return res.status(404).json({
        status: 'error',
        message: 'Recepción no encontrada',
        data: null
      });
    }

    // Solo se pueden modificar recepciones en estado ABI
    if (recepcion.estado !== 'ABI') {
      return res.status(400).json({
        status: 'error',
        message: 'Solo se pueden modificar recepciones en estado ABI',
        data: null
      });
    }

    // Actualizar cantidades recibidas
    for (const detalle of detalles) {
      if (!detalle.id_producto || detalle.cantidad_recibida < 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Cada detalle debe tener id_producto y cantidad_recibida >= 0',
          data: null
        });
      }

      await prisma.detalle_recepcion.update({
        where: {
          id_recepcion_id_producto: {
            id_recepcion,
            id_producto: detalle.id_producto
          }
        },
        data: {
          cantidad_recibida: detalle.cantidad_recibida
        }
      });
    }

    // Obtener recepción actualizada
    const recepcionActualizada = await prisma.recepcion.findUnique({
      where: { id_recepcion },
      include: {
        detalle_recepcion: {
          include: {
            producto: true
          }
        }
      }
    });

    return res.json({
      status: 'success',
      message: 'Recepción actualizada correctamente',
      data: recepcionActualizada
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/bodega/recepciones/:id/aprobar
 * F3.2 - Aprobar recepción (actualiza stock e inventario)
 * Body: { descripcion_ajuste? }
 * 
 * REFACTORIZADO: Usa fn_aprobar_recepcion() de la BD
 */
export const aprobarRecepcion = async (req, res, next) => {
  try {
    const id_recepcion = Number(req.params.id);
    const { descripcion_ajuste } = req.body;
    const id_usuario = req.usuario?.id_usuario || null;

    if (isNaN(id_recepcion)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de recepción inválido',
        data: null
      });
    }

    // 🔷 LLAMAR FUNCIÓN DE BD: fn_aprobar_recepcion()
    // Esta función actualiza stock, costo promedio y genera ajuste de inventario
    const resultado = await prisma.$queryRaw`
      SELECT * FROM fn_aprobar_recepcion(
        ${id_recepcion}::INTEGER,
        ${descripcion_ajuste || null}::TEXT,
        ${id_usuario}::INTEGER
      )
    `;

    if (!resultado || resultado.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Error al aprobar recepción',
        data: null
      });
    }

    const aprobacion = resultado[0];

    // Validar si BD retornó error
    if (!aprobacion.resultado || aprobacion.mensaje?.includes('ERROR')) {
      return res.status(400).json({
        status: 'error',
        message: aprobacion.mensaje || 'Error al aprobar recepción',
        data: null
      });
    }

    return res.json({
      status: 'success',
      message: 'Recepción aprobada exitosamente',
      data: {
        id_recepcion: id_recepcion,
        id_ajuste_generado: aprobacion.id_ajuste_generado,
        mensaje: aprobacion.mensaje
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/bodega/recepciones/:id/anular
 * F3.3 - Anular recepción (solo si está en estado ABI)
 * Body: { motivo_anulacion? }
 * 
 * REFACTORIZADO: Usa fn_anular_recepcion() de la BD
 */
export const anularRecepcion = async (req, res, next) => {
  try {
    const id_recepcion = Number(req.params.id);
    const { motivo_anulacion } = req.body;
    const id_usuario = req.usuario?.id_usuario || null;

    if (isNaN(id_recepcion)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de recepción inválido',
        data: null
      });
    }

    // 🔷 LLAMAR FUNCIÓN DE BD: fn_anular_recepcion()
    const resultado = await prisma.$queryRaw`
      SELECT * FROM fn_anular_recepcion(
        ${id_recepcion}::INTEGER,
        ${motivo_anulacion || null}::TEXT,
        ${id_usuario}::INTEGER
      )
    `;

    if (!resultado || resultado.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Error al anular recepción',
        data: null
      });
    }

    const anulacion = resultado[0];

    // Validar si BD retornó error
    if (!anulacion.resultado || anulacion.mensaje?.includes('ERROR')) {
      return res.status(400).json({
        status: 'error',
        message: anulacion.mensaje || 'Error al anular recepción',
        data: null
      });
    }

    return res.json({
      status: 'success',
      message: 'Recepción anulada exitosamente',
      data: {
        id_recepcion: id_recepcion,
        mensaje: anulacion.mensaje
      }
    });
  } catch (err) {
    next(err);
  }
};

export default {
  listarRecepciones,
  obtenerRecepcion,
  buscarRecepciones,
  registrarRecepcion,
  aprobarRecepcion,
  anularRecepcion,
  modificarRecepcion
};
