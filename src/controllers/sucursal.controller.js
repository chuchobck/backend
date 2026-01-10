import prisma from '../lib/prisma.js';

/**
 * Sucursal Controller - CRUD completo con eliminación lógica
 */

/**
 * GET /api/v1/sucursales
 */
export const listarSucursales = async (req, res, next) => {
  try {
    const sucursales = await prisma.sucursal.findMany({
      where: { activo: true },
      include: {
        ciudad: {
          select: { id_ciudad: true, descripcion: true }
        }
      },
      orderBy: { nombre: 'asc' }
    });

    if (!sucursales || sucursales.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No existen sucursales registradas',
        data: []
      });
    }

    return res.json({ status: 'success', message: 'Sucursales obtenidas', data: sucursales });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/sucursales/:id
 */
export const obtenerSucursal = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ status: 'error', message: 'ID de sucursal es requerido', data: null });
    }

    const sucursal = await prisma.sucursal.findUnique({
      where: { id_sucursal: id },
      include: { ciudad: true }
    });

    if (!sucursal) {
      return res.status(404).json({ status: 'error', message: 'Sucursal no encontrada', data: null });
    }

    return res.json({ status: 'success', message: 'Sucursal obtenida', data: sucursal });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/sucursales/buscar
 */
export const buscarSucursales = async (req, res, next) => {
  try {
    const { codigo, nombre, id_ciudad, activo } = req.query;

    if (!codigo && !nombre && !id_ciudad && typeof activo === 'undefined') {
      return res.status(400).json({ status: 'error', message: 'Ingrese al menos un criterio de búsqueda', data: null });
    }

    const where = {};

    if (codigo) {
      where.codigo = { contains: codigo, mode: 'insensitive' };
    }

    if (nombre) {
      where.nombre = { contains: nombre, mode: 'insensitive' };
    }

    if (id_ciudad) {
      where.id_ciudad = id_ciudad;
    }

    if (typeof activo !== 'undefined') {
      const activoBool = String(activo).toLowerCase() === 'true';
      where.activo = activoBool;
    }

    const resultados = await prisma.sucursal.findMany({
      where,
      include: { ciudad: true },
      orderBy: { nombre: 'asc' }
    });

    if (!resultados || resultados.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No se encontraron sucursales', data: [] });
    }

    return res.json({ status: 'success', message: 'Búsqueda completada', data: resultados });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/sucursales
 */
export const crearSucursal = async (req, res, next) => {
  try {
    const { codigo, nombre, direccion, id_ciudad, telefono, horario, es_punto_retiro } = req.body;

    if (!codigo || !nombre || !direccion || !id_ciudad) {
      return res.status(400).json({ status: 'error', message: 'codigo, nombre, direccion e id_ciudad son requeridos', data: null });
    }

    // Verificar unicidad de codigo
    const existente = await prisma.sucursal.findUnique({ where: { codigo } });
    if (existente) {
      return res.status(409).json({ status: 'error', message: 'Código de sucursal ya existe', data: null });
    }

    // Verificar que la ciudad existe
    const ciudad = await prisma.ciudad.findUnique({ where: { id_ciudad } });
    if (!ciudad) {
      return res.status(400).json({ status: 'error', message: 'La ciudad indicada no existe', data: null });
    }

    const nuevo = await prisma.sucursal.create({
      data: {
        codigo,
        nombre,
        direccion,
        id_ciudad,
        telefono: telefono || null,
        horario: horario || null,
        activo: true,
        es_punto_retiro: typeof es_punto_retiro === 'undefined' ? true : Boolean(es_punto_retiro)
      }
    });

    return res.status(201).json({ status: 'success', message: 'Sucursal creada correctamente', data: nuevo });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/sucursales/:id
 */
export const actualizarSucursal = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { nombre, direccion, id_ciudad, telefono, horario, es_punto_retiro } = req.body;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'ID de sucursal es requerido', data: null });
    }

    const sucursal = await prisma.sucursal.findUnique({ where: { id_sucursal: id } });
    if (!sucursal) {
      return res.status(404).json({ status: 'error', message: 'Sucursal no encontrada', data: null });
    }

    // No permitir actualizar codigo
    if (req.body.codigo && req.body.codigo !== sucursal.codigo) {
      return res.status(400).json({ status: 'error', message: 'No está permitido actualizar el código de la sucursal', data: null });
    }

    // Si cambia ciudad, validar existencia
    if (id_ciudad) {
      const ciudad = await prisma.ciudad.findUnique({ where: { id_ciudad } });
      if (!ciudad) {
        return res.status(400).json({ status: 'error', message: 'La ciudad indicada no existe', data: null });
      }
    }

    const actualizado = await prisma.sucursal.update({
      where: { id_sucursal: id },
      data: {
        nombre: nombre ?? sucursal.nombre,
        direccion: direccion ?? sucursal.direccion,
        id_ciudad: id_ciudad ?? sucursal.id_ciudad,
        telefono: typeof telefono === 'undefined' ? sucursal.telefono : telefono,
        horario: typeof horario === 'undefined' ? sucursal.horario : horario,
        es_punto_retiro: typeof es_punto_retiro === 'undefined' ? sucursal.es_punto_retiro : Boolean(es_punto_retiro)
      }
    });

    return res.json({ status: 'success', message: 'Sucursal actualizada correctamente', data: actualizado });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/sucursales/:id  (eliminación lógica)
 */
export const eliminarSucursal = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ status: 'error', message: 'ID de sucursal es requerido', data: null });
    }

    const sucursal = await prisma.sucursal.findUnique({ where: { id_sucursal: id } });
    if (!sucursal) {
      return res.status(404).json({ status: 'error', message: 'Sucursal no encontrada', data: null });
    }

    if (sucursal.activo === false) {
      return res.status(409).json({ status: 'error', message: 'La sucursal ya se encuentra inactiva', data: null });
    }

    await prisma.sucursal.update({ where: { id_sucursal: id }, data: { activo: false } });

    return res.json({ status: 'success', message: 'Sucursal desactivada correctamente', data: { id_sucursal: id } });
  } catch (err) {
    next(err);
  }
};

export default null;
