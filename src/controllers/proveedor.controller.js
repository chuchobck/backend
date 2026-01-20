// src/controllers/proveedor.controller.js
// 🔵 PERSONA 1: Módulo F1 - Gestión de Proveedores
import prisma from '../lib/prisma.js';

/**
 * GET /api/v1/proveedores
 * F1.4.1 - Consulta general de proveedores
 */
export const listarProveedores = async (req, res, next) => {
  try {
    const proveedores = await prisma.proveedor.findMany({
      where: { estado: 'ACT' },
      include: { ciudad: true }
    });

    if (proveedores.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No existen proveedores registrados',
        data: []
      });
    }

    res.json({
      status: 'success',
      message: 'Proveedores obtenidos correctamente',
      data: proveedores
    });
  } catch (err) {
    next(err); // E1: Desconexión BDD
  }
};

/**
 * GET /api/v1/proveedores/:id
 * Obtener proveedor por ID
 */
export const obtenerProveedor = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID inválido',
        data: null
      });
    }

    const proveedor = await prisma.proveedor.findUnique({
      where: { id_proveedor: id },
      include: { ciudad: true }
    });

    if (!proveedor) {
      return res.status(404).json({
        status: 'error',
        message: 'Proveedor no existe',
        data: null
      });
    }

    res.json({
      status: 'success',
      message: 'Proveedor obtenido correctamente',
      data: proveedor
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/proveedores/buscar
 * F1.4.2 - Consulta por parámetros
 */
export const buscarProveedores = async (req, res, next) => {
  try {
    const { ruc, nombre, ciudad } = req.query;

    // E5: parámetros faltantes
    if (!ruc && !nombre && !ciudad) {
      return res.status(400).json({
        status: 'error',
        message: 'Ingrese al menos un criterio de búsqueda',
        data: null
      });
    }

    const proveedores = await prisma.proveedor.findMany({
      where: {
        estado: 'ACT',
        AND: [
          ruc ? { ruc: { contains: ruc } } : {},
          nombre ? { nombre: { contains: nombre, mode: 'insensitive' } } : {},
          ciudad ? { ciudadId: Number(ciudad) } : {}
        ]
      },
      include: { ciudad: true }
    });

    if (proveedores.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron proveedores',
        data: []
      });
    }

    res.json({
      status: 'success',
      message: 'Búsqueda completada',
      data: proveedores
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/proveedores
 * F1.1 - Ingreso de proveedor
 */
export const crearProveedor = async (req, res, next) => {
  try {
    const { ruc, nombre, direccion, telefono, email, ciudadId } = req.body;

    // E5: Datos obligatorios faltantes
    if (!ruc || !nombre || !ciudadId) {
      return res.status(400).json({
        status: 'error',
        message: 'Complete todos los campos requeridos',
        data: null
      });
    }

    // E4: Ciudad inexistente
    const ciudad = await prisma.ciudad.findUnique({
      where: { id_ciudad: Number(ciudadId) }
    });
    if (!ciudad) {
      return res.status(400).json({
        status: 'error',
        message: 'La ciudad seleccionada no es válida',
        data: null
      });
    }

    // E2 / E3: Proveedor o RUC duplicado
    const proveedorExistente = await prisma.proveedor.findFirst({
      where: { ruc }
    });
    if (proveedorExistente) {
      return res.status(409).json({
        status: 'error',
        message: 'El RUC o proveedor ya se encuentra registrado',
        data: null
      });
    }

    const proveedor = await prisma.proveedor.create({
      data: {
        ruc,
        nombre,
        direccion,
        telefono,
        email,
        ciudadId: Number(ciudadId),
        estado: 'ACT'
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Proveedor creado correctamente',
      data: proveedor
    });
  } catch (err) {
    next(err); // E1
  }
};

/**
 * PUT /api/v1/proveedores/:id
 * F1.2 - Actualización de proveedor
 */
export const actualizarProveedor = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { nombre, direccion, telefono, email, ciudadId } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID inválido',
        data: null
      });
    }

    const proveedor = await prisma.proveedor.findUnique({
      where: { id_proveedor: id }
    });

    // E2: proveedor no existe
    if (!proveedor) {
      return res.status(404).json({
        status: 'error',
        message: 'Proveedor no existe',
        data: null
      });
    }

    // E4: datos inválidos
    if (ciudadId) {
      const ciudad = await prisma.ciudad.findUnique({
        where: { id_ciudad: Number(ciudadId) }
      });
      if (!ciudad) {
        return res.status(400).json({
          status: 'error',
          message: 'La ciudad seleccionada no es válida',
          data: null
        });
      }
    }

    const actualizado = await prisma.proveedor.update({
      where: { id_proveedor: id },
      data: {
        nombre,
        direccion,
        telefono,
        email,
        ciudadId: ciudadId ? Number(ciudadId) : undefined
      }
    });

    res.json({
      status: 'success',
      message: 'Proveedor actualizado correctamente',
      data: actualizado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/proveedores/:id
 * F1.3 - Eliminación lógica
 */
export const eliminarProveedor = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID inválido',
        data: null
      });
    }

    const proveedor = await prisma.proveedor.findUnique({
      where: { id_proveedor: id }
    });

    // E2: proveedor no existe
    if (!proveedor) {
      return res.status(404).json({
        status: 'error',
        message: 'Proveedor no existe',
        data: null
      });
    }

    // E3: proveedor inactivo
    if (proveedor.estado === 'INA') {
      return res.status(400).json({
        status: 'error',
        message: 'El proveedor ya se encuentra inactivo',
        data: null
      });
    }

    await prisma.proveedor.update({
      where: { id_proveedor: id },
      data: { estado: 'INA' }
    });

    res.json({
      status: 'success',
      message: 'Proveedor eliminado correctamente',
      data: null
    });
  } catch (err) {
    next(err); // E1
  }
};
