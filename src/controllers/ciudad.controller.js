import prisma from '../lib/prisma.js';

// =============================================
// CRUD CIUDADES
// =============================================

/**
 * GET /api/v1/ciudades
 * Listar todas las ciudades
 */
export const listarCiudades = async (req, res, next) => {
  try {
    const ciudades = await prisma.ciudad.findMany({
      orderBy: { descripcion: 'asc' },
      include: {
        _count: {
          select: {
            cliente: true,
            proveedor: true
          }
        }
      }
    });

    res.json({
      status: 'success',
      message: `${ciudades.length} ciudades encontradas`,
      data: ciudades
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/ciudades/:id
 * Obtener una ciudad por ID
 */
export const obtenerCiudad = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validar formato de ID (debe ser CHAR(3))
    if (!id || id.length !== 3) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de ciudad inválido. Debe tener exactamente 3 caracteres',
        data: null
      });
    }

    const ciudad = await prisma.ciudad.findUnique({
      where: { id_ciudad: id.toUpperCase() },
      include: {
        _count: {
          select: {
            cliente: true,
            proveedor: true
          }
        }
      }
    });

    if (!ciudad) {
      return res.status(404).json({
        status: 'error',
        message: 'Ciudad no encontrada',
        data: null
      });
    }

    res.json({
      status: 'success',
      message: 'Ciudad obtenida exitosamente',
      data: ciudad
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/ciudades
 * Crear una nueva ciudad
 */
export const crearCiudad = async (req, res, next) => {
  try {
    const { id_ciudad, descripcion } = req.body;

    // Validaciones básicas
    if (!id_ciudad || !descripcion) {
      return res.status(400).json({
        status: 'error',
        message: 'id_ciudad y descripcion son requeridos',
        data: null
      });
    }

    // Validar formato de id_ciudad (CHAR(3))
    const idCiudadUpper = id_ciudad.trim().toUpperCase();
    if (idCiudadUpper.length !== 3) {
      return res.status(400).json({
        status: 'error',
        message: 'id_ciudad debe tener exactamente 3 caracteres',
        data: null
      });
    }

    // Validar que no contenga caracteres especiales
    if (!/^[A-Z0-9]{3}$/.test(idCiudadUpper)) {
      return res.status(400).json({
        status: 'error',
        message: 'id_ciudad solo puede contener letras y números',
        data: null
      });
    }

    // Validar descripción
    const descripcionTrim = descripcion.trim();
    if (descripcionTrim.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'La descripción no puede estar vacía',
        data: null
      });
    }

    if (descripcionTrim.length > 100) {
      return res.status(400).json({
        status: 'error',
        message: 'La descripción no puede exceder 100 caracteres',
        data: null
      });
    }

    // Verificar que no exista
    const ciudadExistente = await prisma.ciudad.findUnique({
      where: { id_ciudad: idCiudadUpper }
    });

    if (ciudadExistente) {
      return res.status(409).json({
        status: 'error',
        message: `Ya existe una ciudad con el código ${idCiudadUpper}`,
        data: ciudadExistente
      });
    }

    // Crear ciudad
    const ciudad = await prisma.ciudad.create({
      data: { 
        id_ciudad: idCiudadUpper, 
        descripcion: descripcionTrim 
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Ciudad creada exitosamente',
      data: ciudad
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/ciudades/:id
 * Actualizar una ciudad
 */
export const actualizarCiudad = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { descripcion } = req.body;

    // Validar ID
    if (!id || id.length !== 3) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de ciudad inválido. Debe tener exactamente 3 caracteres',
        data: null
      });
    }

    // Validar descripción
    if (!descripcion) {
      return res.status(400).json({
        status: 'error',
        message: 'La descripción es requerida',
        data: null
      });
    }

    const descripcionTrim = descripcion.trim();
    if (descripcionTrim.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'La descripción no puede estar vacía',
        data: null
      });
    }

    if (descripcionTrim.length > 100) {
      return res.status(400).json({
        status: 'error',
        message: 'La descripción no puede exceder 100 caracteres',
        data: null
      });
    }

    const idUpper = id.toUpperCase();

    // Verificar que existe
    const ciudadExistente = await prisma.ciudad.findUnique({
      where: { id_ciudad: idUpper }
    });

    if (!ciudadExistente) {
      return res.status(404).json({
        status: 'error',
        message: 'Ciudad no encontrada',
        data: null
      });
    }

    // Actualizar
    const ciudad = await prisma.ciudad.update({
      where: { id_ciudad: idUpper },
      data: { descripcion: descripcionTrim }
    });

    res.json({
      status: 'success',
      message: 'Ciudad actualizada exitosamente',
      data: ciudad
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/ciudades/:id
 * Eliminar una ciudad (solo si no tiene relaciones)
 */
export const eliminarCiudad = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validar ID
    if (!id || id.length !== 3) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de ciudad inválido. Debe tener exactamente 3 caracteres',
        data: null
      });
    }

    const idUpper = id.toUpperCase();

    // Verificar que existe
    const ciudad = await prisma.ciudad.findUnique({
      where: { id_ciudad: idUpper },
      include: {
        _count: {
          select: {
            cliente: true,
            proveedor: true
          }
        }
      }
    });

    if (!ciudad) {
      return res.status(404).json({
        status: 'error',
        message: 'Ciudad no encontrada',
        data: null
      });
    }

    // Verificar que no tenga relaciones
    const totalRelaciones = ciudad._count.cliente + ciudad._count.proveedor;
    
    if (totalRelaciones > 0) {
      return res.status(409).json({
        status: 'error',
        message: `No se puede eliminar la ciudad. Tiene ${ciudad._count.cliente} cliente(s) y ${ciudad._count.proveedor} proveedor(es) asociados`,
        data: {
          clientes: ciudad._count.cliente,
          proveedores: ciudad._count.proveedor
        }
      });
    }

    // Eliminar ciudad (eliminación física)
    await prisma.ciudad.delete({
      where: { id_ciudad: idUpper }
    });

    res.json({
      status: 'success',
      message: `Ciudad ${idUpper} eliminada exitosamente`,
      data: null
    });
  } catch (err) {
    next(err);
  }
};