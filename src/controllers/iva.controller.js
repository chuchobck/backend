import prisma from '../lib/prisma.js';

// =============================================
// CRUD IVA
// =============================================

/**
 * GET /api/v1/iva
 * Listar todas las configuraciones de IVA
 */
export const listarIva = async (req, res, next) => {
  try {
    const ivas = await prisma.iva.findMany({
      orderBy: { fecha_inicio: 'desc' }
    });

    res.json({
      status: 'success',
      message: `${ivas.length} configuraciones de IVA encontradas`,
      data: ivas
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/iva/activo
 * Obtener configuración de IVA activa
 */
export const obtenerIvaActivo = async (req, res, next) => {
  try {
    const now = new Date();

    const iva = await prisma.iva.findFirst({
      where: {
        estado: 'A',
        fecha_inicio: { lte: now },
        OR: [
          { fecha_fin: null },
          { fecha_fin: { gte: now } }
        ]
      },
      orderBy: { fecha_inicio: 'desc' }
    });

    if (!iva) {
      return res.status(404).json({
        status: 'error',
        message: 'No hay configuración de IVA activa para la fecha actual',
        data: null
      });
    }

    res.json({
      status: 'success',
      message: 'IVA activo obtenido exitosamente',
      data: iva
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/iva/:id
 * Obtener una configuración de IVA por ID
 */
export const obtenerIva = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de IVA inválido',
        data: null
      });
    }

    const iva = await prisma.iva.findUnique({
      where: { id_iva: id },
      include: {
        _count: {
          select: { factura: true }
        }
      }
    });

    if (!iva) {
      return res.status(404).json({
        status: 'error',
        message: 'Configuración de IVA no encontrada',
        data: null
      });
    }

    res.json({
      status: 'success',
      message: 'IVA obtenido exitosamente',
      data: iva
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/iva
 * Crear una nueva configuración de IVA
 */
export const crearIva = async (req, res, next) => {
  try {
    const { porcentaje, fecha_inicio, fecha_fin, estado } = req.body;

    // Validaciones básicas
    if (!porcentaje || !fecha_inicio || !estado) {
      return res.status(400).json({
        status: 'error',
        message: 'porcentaje, fecha_inicio y estado son requeridos',
        data: null
      });
    }

    // Validar porcentaje
    const porcentajeNum = parseFloat(porcentaje);
    if (isNaN(porcentajeNum) || porcentajeNum < 0 || porcentajeNum > 100) {
      return res.status(400).json({
        status: 'error',
        message: 'El porcentaje debe ser un número entre 0 y 100',
        data: null
      });
    }

    // Validar estado
    if (!['A', 'I'].includes(estado)) {
      return res.status(400).json({
        status: 'error',
        message: 'El estado debe ser "A" (Activo) o "I" (Inactivo)',
        data: null
      });
    }

    // Validar fechas
    const fechaInicioDate = new Date(fecha_inicio);
    if (isNaN(fechaInicioDate.getTime())) {
      return res.status(400).json({
        status: 'error',
        message: 'Fecha de inicio inválida',
        data: null
      });
    }

    let fechaFinDate = null;
    if (fecha_fin) {
      fechaFinDate = new Date(fecha_fin);
      if (isNaN(fechaFinDate.getTime())) {
        return res.status(400).json({
          status: 'error',
          message: 'Fecha de fin inválida',
          data: null
        });
      }

      // Validar que fecha_fin > fecha_inicio
      if (fechaFinDate <= fechaInicioDate) {
        return res.status(400).json({
          status: 'error',
          message: 'La fecha de fin debe ser posterior a la fecha de inicio',
          data: null
        });
      }
    }

    // Validar que no haya solapamiento de rangos si está activo
    if (estado === 'A') {
      const solapamiento = await prisma.iva.findFirst({
        where: {
          estado: 'A',
          AND: [
            { fecha_inicio: { lte: fechaFinDate || new Date('2099-12-31') } },
            {
              OR: [
                { fecha_fin: null },
                { fecha_fin: { gte: fechaInicioDate } }
              ]
            }
          ]
        }
      });

      if (solapamiento) {
        return res.status(409).json({
          status: 'error',
          message: 'Ya existe una configuración de IVA activa para este rango de fechas',
          data: { iva_existente: solapamiento }
        });
      }
    }

    // Crear IVA
    const iva = await prisma.iva.create({
      data: {
        porcentaje: porcentajeNum,
        fecha_inicio: fechaInicioDate,
        fecha_fin: fechaFinDate,
        estado
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Configuración de IVA creada exitosamente',
      data: iva
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/iva/:id
 * Actualizar una configuración de IVA
 */
export const actualizarIva = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { porcentaje, fecha_inicio, fecha_fin, estado } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de IVA inválido',
        data: null
      });
    }

    // Verificar que existe
    const ivaExistente = await prisma.iva.findUnique({
      where: { id_iva: id },
      include: {
        _count: {
          select: { factura: true }
        }
      }
    });

    if (!ivaExistente) {
      return res.status(404).json({
        status: 'error',
        message: 'Configuración de IVA no encontrada',
        data: null
      });
    }

    // Si tiene facturas asociadas, solo permitir cambio de estado
    if (ivaExistente._count.factura > 0) {
      if (porcentaje !== undefined || fecha_inicio !== undefined || fecha_fin !== undefined) {
        return res.status(400).json({
          status: 'error',
          message: `No se puede modificar porcentaje o fechas. Esta configuración tiene ${ivaExistente._count.factura} facturas asociadas`,
          data: null
        });
      }
    }

    const data = {};

    // Validar porcentaje
    if (porcentaje !== undefined) {
      const porcentajeNum = parseFloat(porcentaje);
      if (isNaN(porcentajeNum) || porcentajeNum < 0 || porcentajeNum > 100) {
        return res.status(400).json({
          status: 'error',
          message: 'El porcentaje debe ser un número entre 0 y 100',
          data: null
        });
      }
      data.porcentaje = porcentajeNum;
    }

    // Validar estado
    if (estado !== undefined) {
      if (!['A', 'I'].includes(estado)) {
        return res.status(400).json({
          status: 'error',
          message: 'El estado debe ser "A" (Activo) o "I" (Inactivo)',
          data: null
        });
      }
      data.estado = estado;
    }

    // Validar fechas
    if (fecha_inicio !== undefined) {
      const fechaInicioDate = new Date(fecha_inicio);
      if (isNaN(fechaInicioDate.getTime())) {
        return res.status(400).json({
          status: 'error',
          message: 'Fecha de inicio inválida',
          data: null
        });
      }
      data.fecha_inicio = fechaInicioDate;
    }

    if (fecha_fin !== undefined) {
      if (fecha_fin === null) {
        data.fecha_fin = null;
      } else {
        const fechaFinDate = new Date(fecha_fin);
        if (isNaN(fechaFinDate.getTime())) {
          return res.status(400).json({
            status: 'error',
            message: 'Fecha de fin inválida',
            data: null
          });
        }

        // Validar coherencia con fecha_inicio
        const fechaInicio = data.fecha_inicio || ivaExistente.fecha_inicio;
        if (fechaFinDate <= fechaInicio) {
          return res.status(400).json({
            status: 'error',
            message: 'La fecha de fin debe ser posterior a la fecha de inicio',
            data: null
          });
        }

        data.fecha_fin = fechaFinDate;
      }
    }

    const iva = await prisma.iva.update({
      where: { id_iva: id },
      data
    });

    res.json({
      status: 'success',
      message: 'Configuración de IVA actualizada exitosamente',
      data: iva
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/iva/:id
 * Desactivar una configuración de IVA (eliminación lógica)
 */
export const eliminarIva = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de IVA inválido',
        data: null
      });
    }

    // Verificar que la configuración existe
    const iva = await prisma.iva.findUnique({
      where: { id_iva: id },
      include: {
        _count: {
          select: { factura: true }
        }
      }
    });

    if (!iva) {
      return res.status(404).json({
        status: 'error',
        message: 'Configuración de IVA no encontrada',
        data: null
      });
    }

    // Verificar que NO esté ya inactivo
    if (iva.estado === 'I') {
      return res.status(400).json({
        status: 'error',
        message: 'La configuración de IVA ya se encuentra desactivada',
        data: null
      });
    }

    // Advertir si tiene facturas asociadas
    let advertencia = null;
    if (iva._count.factura > 0) {
      advertencia = `Esta configuración tiene ${iva._count.factura} facturas asociadas`;
    }

    // Actualizar estado a I (Inactivo)
    const ivaDesactivado = await prisma.iva.update({
      where: { id_iva: id },
      data: { estado: 'I' }
    });

    res.json({
      status: 'success',
      message: 'Configuración de IVA desactivada correctamente',
      data: ivaDesactivado,
      advertencia
    });
  } catch (err) {
    next(err);
  }
};