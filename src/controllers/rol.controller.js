import prisma from '../lib/prisma.js';

// =============================================
// CRUD ROLES
// =============================================

/**
 * GET /api/v1/roles
 * Listar todos los roles activos
 */
export const listarRoles = async (req, res, next) => {
  try {
    const roles = await prisma.rol.findMany({
      where: { estado: 'ACT' },
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { empleado: true }
        }
      }
    });

    res.json({
      status: 'success',
      message: `${roles.length} roles activos encontrados`,
      data: roles
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/roles/:id
 * Obtener un rol por ID
 */
export const obtenerRol = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de rol inválido',
        data: null
      });
    }

    const rol = await prisma.rol.findUnique({
      where: { id_rol: id },
      include: {
        _count: {
          select: { empleado: true }
        }
      }
    });

    if (!rol) {
      return res.status(404).json({
        status: 'error',
        message: 'Rol no encontrado',
        data: null
      });
    }

    res.json({
      status: 'success',
      message: 'Rol obtenido exitosamente',
      data: rol
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/roles
 * Crear un nuevo rol
 */
export const crearRol = async (req, res, next) => {
  try {
    const { codigo, nombre, descripcion } = req.body;

    // Validar campos obligatorios
    if (!codigo || !nombre) {
      return res.status(400).json({
        status: 'error',
        message: 'codigo y nombre son requeridos',
        data: null
      });
    }

    // Validar código
    const codigoTrim = codigo.trim().toUpperCase();
    
    if (codigoTrim.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'El código no puede estar vacío',
        data: null
      });
    }

    if (codigoTrim.length > 20) {
      return res.status(400).json({
        status: 'error',
        message: 'El código no puede exceder 20 caracteres',
        data: null
      });
    }

    // Validar que el código solo contenga letras, números y guiones
    if (!/^[A-Z0-9_-]+$/.test(codigoTrim)) {
      return res.status(400).json({
        status: 'error',
        message: 'El código solo puede contener letras, números, guiones y guiones bajos',
        data: null
      });
    }

    // Validar nombre
    const nombreTrim = nombre.trim();
    
    if (nombreTrim.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'El nombre no puede estar vacío',
        data: null
      });
    }

    if (nombreTrim.length > 50) {
      return res.status(400).json({
        status: 'error',
        message: 'El nombre no puede exceder 50 caracteres',
        data: null
      });
    }

    // Validar descripción si se proporciona
    if (descripcion && descripcion.trim().length > 255) {
      return res.status(400).json({
        status: 'error',
        message: 'La descripción no puede exceder 255 caracteres',
        data: null
      });
    }

    // Verificar que el código no exista
    const codigoExistente = await prisma.rol.findUnique({
      where: { codigo: codigoTrim }
    });

    if (codigoExistente) {
      return res.status(409).json({
        status: 'error',
        message: `Ya existe un rol con el código ${codigoTrim}`,
        data: codigoExistente
      });
    }

    // Crear el rol
    const rol = await prisma.rol.create({
      data: {
        codigo: codigoTrim,
        nombre: nombreTrim,
        descripcion: descripcion?.trim() || null,
        estado: 'ACT'
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Rol creado exitosamente',
      data: rol
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        status: 'error',
        message: 'El código del rol ya existe',
        data: null
      });
    }
    next(err);
  }
};

/**
 * PUT /api/v1/roles/:id
 * Actualizar un rol
 */
export const actualizarRol = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { codigo, nombre, descripcion } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de rol inválido',
        data: null
      });
    }

    // Verificar que el rol existe
    const rolExistente = await prisma.rol.findUnique({
      where: { id_rol: id },
      include: {
        _count: {
          select: { empleado: true }
        }
      }
    });

    if (!rolExistente) {
      return res.status(404).json({
        status: 'error',
        message: 'Rol no encontrado',
        data: null
      });
    }

    // Construir objeto de actualización
    const data = {};

    // Validar y actualizar código
    if (codigo !== undefined) {
      const codigoTrim = codigo.trim().toUpperCase();

      if (codigoTrim.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'El código no puede estar vacío',
          data: null
        });
      }

      if (codigoTrim.length > 20) {
        return res.status(400).json({
          status: 'error',
          message: 'El código no puede exceder 20 caracteres',
          data: null
        });
      }

      if (!/^[A-Z0-9_-]+$/.test(codigoTrim)) {
        return res.status(400).json({
          status: 'error',
          message: 'El código solo puede contener letras, números, guiones y guiones bajos',
          data: null
        });
      }

      // Si está cambiando el código, verificar que no exista
      if (codigoTrim !== rolExistente.codigo) {
        const codigoExiste = await prisma.rol.findUnique({
          where: { codigo: codigoTrim }
        });

        if (codigoExiste) {
          return res.status(409).json({
            status: 'error',
            message: `Ya existe un rol con el código ${codigoTrim}`,
            data: null
          });
        }
      }

      data.codigo = codigoTrim;
    }

    // Validar y actualizar nombre
    if (nombre !== undefined) {
      const nombreTrim = nombre.trim();

      if (nombreTrim.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'El nombre no puede estar vacío',
          data: null
        });
      }

      if (nombreTrim.length > 50) {
        return res.status(400).json({
          status: 'error',
          message: 'El nombre no puede exceder 50 caracteres',
          data: null
        });
      }

      data.nombre = nombreTrim;
    }

    // Validar y actualizar descripción
    if (descripcion !== undefined) {
      if (descripcion && descripcion.trim().length > 255) {
        return res.status(400).json({
          status: 'error',
          message: 'La descripción no puede exceder 255 caracteres',
          data: null
        });
      }
      data.descripcion = descripcion?.trim() || null;
    }

    // Si no hay cambios
    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No se proporcionaron campos para actualizar',
        data: null
      });
    }

    // Actualizar el rol
    const rol = await prisma.rol.update({
      where: { id_rol: id },
      data,
      include: {
        _count: {
          select: { empleado: true }
        }
      }
    });

    res.json({
      status: 'success',
      message: 'Rol actualizado exitosamente',
      data: rol
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        status: 'error',
        message: 'El código del rol ya existe',
        data: null
      });
    }
    next(err);
  }
};

/**
 * DELETE /api/v1/roles/:id
 * Eliminar un rol (soft delete)
 */
export const eliminarRol = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de rol inválido',
        data: null
      });
    }

    // Verificar que el rol existe
    const rol = await prisma.rol.findUnique({
      where: { id_rol: id },
      include: {
        _count: {
          select: { empleado: true }
        }
      }
    });

    if (!rol) {
      return res.status(404).json({
        status: 'error',
        message: 'Rol no encontrado',
        data: null
      });
    }

    // Validar que NO esté ya inactivo
    if (rol.estado === 'INA') {
      return res.status(400).json({
        status: 'error',
        message: 'El rol ya se encuentra desactivado',
        data: null
      });
    }

    // Verificar si tiene empleados asignados
    let advertencia = null;
    if (rol._count.empleado > 0) {
      advertencia = `El rol tiene ${rol._count.empleado} empleado(s) asignado(s)`;
    }

    // Desactivar el rol
    const rolDesactivado = await prisma.rol.update({
      where: { id_rol: id },
      data: { estado: 'INA' }
    });

    res.json({
      status: 'success',
      message: 'Rol desactivado exitosamente',
      data: rolDesactivado,
      advertencia
    });
  } catch (err) {
    next(err);
  }
};