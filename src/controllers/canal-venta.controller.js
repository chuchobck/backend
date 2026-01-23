// src/controllers/canal-venta.controller.js
// CRUD para gestión de Canales de Venta

import prisma from '../lib/prisma.js';

/**
 * GET /api/v1/canales-venta
 * Listar todos los canales de venta activos
 */
export const listarCanalesVenta = async (req, res, next) => {
  try {
    const canales = await prisma.canal_venta.findMany({
      where: { estado: 'ACT' },
      include: {
        _count: {
          select: {
            factura: true
          }
        }
      },
      orderBy: { descripcion: 'asc' }
    });

    res.json({
      status: 'success',
      message: `${canales.length} canales de venta activos encontrados`,
      data: canales
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/canales-venta/:id
 * Obtener un canal de venta por ID
 */
export const obtenerCanalVenta = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || id.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de canal inválido',
        data: null
      });
    }

    // Validar formato de ID (CHAR(3))
    const idUpper = id.trim().toUpperCase();
    if (idUpper.length !== 3) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de canal debe tener exactamente 3 caracteres',
        data: null
      });
    }

    const canal = await prisma.canal_venta.findUnique({
      where: { id_canal: idUpper },
      include: {
        _count: {
          select: {
            factura: true
          }
        }
      }
    });

    if (!canal) {
      return res.status(404).json({
        status: 'error',
        message: 'Canal de venta no encontrado',
        data: null
      });
    }

    res.json({
      status: 'success',
      message: 'Canal de venta obtenido correctamente',
      data: canal
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/canales-venta
 * Crear un nuevo canal de venta
 */
export const crearCanalVenta = async (req, res, next) => {
  try {
    const { id_canal, descripcion } = req.body;

    // Validar id_canal
    if (!id_canal || id_canal.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'ID del canal es requerido',
        data: null
      });
    }

    const idTrim = id_canal.trim().toUpperCase();

    if (idTrim.length !== 3) {
      return res.status(400).json({
        status: 'error',
        message: 'ID del canal debe tener exactamente 3 caracteres',
        data: null
      });
    }

    // Validar que solo contenga letras y números
    if (!/^[A-Z0-9]{3}$/.test(idTrim)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID del canal solo puede contener letras y números',
        data: null
      });
    }

    // Validar descripción
    if (!descripcion || descripcion.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Descripción del canal es requerida',
        data: null
      });
    }

    const descripcionTrim = descripcion.trim();

    if (descripcionTrim.length > 100) {
      return res.status(400).json({
        status: 'error',
        message: 'La descripción no puede exceder 100 caracteres',
        data: null
      });
    }

    // Verificar que el canal no exista
    const canalExistente = await prisma.canal_venta.findUnique({
      where: { id_canal: idTrim }
    });

    if (canalExistente) {
      return res.status(409).json({
        status: 'error',
        message: `Ya existe un canal con el código ${idTrim}`,
        data: canalExistente
      });
    }

    // Crear el canal
    const nuevoCanal = await prisma.canal_venta.create({
      data: {
        id_canal: idTrim,
        descripcion: descripcionTrim,
        estado: 'ACT'
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Canal de venta creado correctamente',
      data: nuevoCanal
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/canales-venta/:id
 * Actualizar un canal de venta
 */
export const actualizarCanalVenta = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { descripcion } = req.body;

    if (!id || id.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de canal inválido',
        data: null
      });
    }

    const idUpper = id.trim().toUpperCase();

    if (idUpper.length !== 3) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de canal debe tener exactamente 3 caracteres',
        data: null
      });
    }

    // Validar descripción
    if (!descripcion || descripcion.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Descripción del canal es requerida',
        data: null
      });
    }

    const descripcionTrim = descripcion.trim();

    if (descripcionTrim.length > 100) {
      return res.status(400).json({
        status: 'error',
        message: 'La descripción no puede exceder 100 caracteres',
        data: null
      });
    }

    // Verificar que el canal existe
    const canal = await prisma.canal_venta.findUnique({
      where: { id_canal: idUpper }
    });

    if (!canal) {
      return res.status(404).json({
        status: 'error',
        message: 'Canal de venta no encontrado',
        data: null
      });
    }

    // Actualizar el canal
    const canalActualizado = await prisma.canal_venta.update({
      where: { id_canal: idUpper },
      data: {
        descripcion: descripcionTrim
      },
      include: {
        _count: {
          select: {
            factura: true
          }
        }
      }
    });

    res.json({
      status: 'success',
      message: 'Canal de venta actualizado correctamente',
      data: canalActualizado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/canales-venta/:id
 * Eliminar (desactivar) un canal de venta
 */
export const eliminarCanalVenta = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || id.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de canal inválido',
        data: null
      });
    }

    const idUpper = id.trim().toUpperCase();

    if (idUpper.length !== 3) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de canal debe tener exactamente 3 caracteres',
        data: null
      });
    }

    // Verificar que el canal existe
    const canal = await prisma.canal_venta.findUnique({
      where: { id_canal: idUpper },
      include: {
        _count: {
          select: {
            factura: true
          }
        }
      }
    });

    if (!canal) {
      return res.status(404).json({
        status: 'error',
        message: 'Canal de venta no encontrado',
        data: null
      });
    }

    // Validar que NO esté ya inactivo
    if (canal.estado === 'INA') {
      return res.status(400).json({
        status: 'error',
        message: 'El canal de venta ya se encuentra desactivado',
        data: null
      });
    }

    // Verificar relaciones con facturas
    let advertencia = null;
    if (canal._count.factura > 0) {
      advertencia = `El canal tiene ${canal._count.factura} factura(s) asociada(s)`;
    }

    // Actualizar estado a INA
    const canalDesactivado = await prisma.canal_venta.update({
      where: { id_canal: idUpper },
      data: { estado: 'INA' }
    });

    res.json({
      status: 'success',
      message: 'Canal de venta desactivado correctamente',
      data: canalDesactivado,
      advertencia
    });
  } catch (err) {
    next(err);
  }
};
