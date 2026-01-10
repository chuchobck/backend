import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

/**
 * Empleado Controller - CRUD con creación automática de usuario y eliminación lógica
 */

export const listarEmpleados = async (req, res, next) => {
  try {
    const empleados = await prisma.empleado.findMany({
      where: { estado: 'ACT' },
      include: {
        usuario: { select: { id_usuario: true, email: true } },
        rol: { select: { id_rol: true, nombre: true, codigo: true } },
        sucursal: { select: { id_sucursal: true, nombre: true, codigo: true } }
      },
      orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }]
    });

    if (!empleados || empleados.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No existen empleados registrados', data: [] });
    }

    return res.json({ status: 'success', message: 'Empleados obtenidos', data: empleados });
  } catch (err) {
    next(err);
  }
};

export const obtenerEmpleado = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ status: 'error', message: 'ID de empleado es requerido', data: null });

    const empleado = await prisma.empleado.findUnique({
      where: { id_empleado: id },
      include: { usuario: true, rol: true, sucursal: true }
    });

    if (!empleado) {
      return res.status(404).json({ status: 'error', message: 'Empleado no encontrado', data: null });
    }

    return res.json({ status: 'success', message: 'Empleado obtenido', data: empleado });
  } catch (err) {
    next(err);
  }
};

export const buscarEmpleados = async (req, res, next) => {
  try {
    const { cedula, nombre, apellido, id_rol, id_sucursal, estado } = req.query;

    if (!cedula && !nombre && !apellido && !id_rol && !id_sucursal && !estado) {
      return res.status(400).json({ status: 'error', message: 'Ingrese al menos un criterio de búsqueda', data: null });
    }

    const where = {};
    if (cedula) where.cedula = { contains: cedula };
    if (nombre) where.nombre = { contains: nombre, mode: 'insensitive' };
    if (apellido) where.apellido = { contains: apellido, mode: 'insensitive' };
    if (id_rol) where.id_rol = Number(id_rol);
    if (id_sucursal) where.id_sucursal = Number(id_sucursal);
    if (estado) where.estado = estado;

    const resultados = await prisma.empleado.findMany({
      where,
      include: { usuario: true, rol: true, sucursal: true },
      orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }]
    });

    if (!resultados || resultados.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No se encontraron empleados', data: [] });
    }

    return res.json({ status: 'success', message: 'Búsqueda completada', data: resultados });
  } catch (err) {
    next(err);
  }
};

export const crearEmpleado = async (req, res, next) => {
  try {
    const { cedula, nombre, apellido, telefono, id_rol, id_sucursal, email, password } = req.body;

    if (!cedula || !nombre || !apellido || !id_rol || !email || !password) {
      return res.status(400).json({ status: 'error', message: 'cedula, nombre, apellido, id_rol, email y password son requeridos', data: null });
    }

    // Validar unicidad de cedula
    const cedulaExist = await prisma.empleado.findUnique({ where: { cedula } });
    if (cedulaExist) return res.status(409).json({ status: 'error', message: 'Cédula ya registrada', data: null });

    // Validar unicidad de email en usuario
    const emailExist = await prisma.usuario.findUnique({ where: { email } });
    if (emailExist) return res.status(409).json({ status: 'error', message: 'Email ya registrado', data: null });

    // Validar rol
    const rol = await prisma.rol.findUnique({ where: { id_rol: Number(id_rol) } });
    if (!rol) return res.status(400).json({ status: 'error', message: 'Rol no existe', data: null });

    // Validar sucursal si viene
    if (id_sucursal) {
      const suc = await prisma.sucursal.findUnique({ where: { id_sucursal: Number(id_sucursal) } });
      if (!suc) return res.status(400).json({ status: 'error', message: 'Sucursal no existe', data: null });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const resultado = await prisma.$transaction(async (tx) => {
      const usuarioCreado = await tx.usuario.create({
        data: { email, password_hash, estado: 'ACT' }
      });

      const empleadoCreado = await tx.empleado.create({
        data: {
          id_usuario: usuarioCreado.id_usuario,
          cedula,
          nombre,
          apellido,
          telefono: telefono || null,
          id_rol: Number(id_rol),
          id_sucursal: id_sucursal ? Number(id_sucursal) : null,
          estado: 'ACT'
        },
        include: { usuario: true, rol: true, sucursal: true }
      });

      return empleadoCreado;
    });

    return res.status(201).json({ status: 'success', message: 'Empleado creado correctamente', data: resultado });
  } catch (err) {
    next(err);
  }
};

export const actualizarEmpleado = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { nombre, apellido, telefono, id_rol, id_sucursal } = req.body;

    if (!id) return res.status(400).json({ status: 'error', message: 'ID de empleado es requerido', data: null });

    const empleado = await prisma.empleado.findUnique({ where: { id_empleado: id } });
    if (!empleado) return res.status(404).json({ status: 'error', message: 'Empleado no encontrado', data: null });

    // No permitir actualizar cedula ni id_usuario
    if (req.body.cedula && req.body.cedula !== empleado.cedula) {
      return res.status(400).json({ status: 'error', message: 'No está permitido actualizar la cédula', data: null });
    }
    if (req.body.id_usuario && Number(req.body.id_usuario) !== empleado.id_usuario) {
      return res.status(400).json({ status: 'error', message: 'No está permitido actualizar id_usuario', data: null });
    }

    if (id_rol) {
      const rol = await prisma.rol.findUnique({ where: { id_rol: Number(id_rol) } });
      if (!rol) return res.status(400).json({ status: 'error', message: 'Rol no existe', data: null });
    }

    if (typeof id_sucursal !== 'undefined' && id_sucursal !== null) {
      const suc = await prisma.sucursal.findUnique({ where: { id_sucursal: Number(id_sucursal) } });
      if (!suc) return res.status(400).json({ status: 'error', message: 'Sucursal no existe', data: null });
    }

    const actualizado = await prisma.empleado.update({
      where: { id_empleado: id },
      data: {
        nombre: nombre ?? empleado.nombre,
        apellido: apellido ?? empleado.apellido,
        telefono: typeof telefono === 'undefined' ? empleado.telefono : telefono,
        id_rol: typeof id_rol === 'undefined' ? empleado.id_rol : Number(id_rol),
        id_sucursal: typeof id_sucursal === 'undefined' ? empleado.id_sucursal : (id_sucursal ? Number(id_sucursal) : null)
      },
      include: { usuario: true, rol: true, sucursal: true }
    });

    return res.json({ status: 'success', message: 'Empleado actualizado correctamente', data: actualizado });
  } catch (err) {
    next(err);
  }
};

export const eliminarEmpleado = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ status: 'error', message: 'ID de empleado es requerido', data: null });

    const empleado = await prisma.empleado.findUnique({ where: { id_empleado: id } });
    if (!empleado) return res.status(404).json({ status: 'error', message: 'Empleado no encontrado', data: null });

    if (empleado.estado === 'INA') return res.status(409).json({ status: 'error', message: 'Empleado ya inactivo', data: null });

    await prisma.$transaction([
      prisma.empleado.update({ where: { id_empleado: id }, data: { estado: 'INA' } }),
      prisma.usuario.update({ where: { id_usuario: empleado.id_usuario }, data: { estado: 'INA' } })
    ]);

    return res.json({ status: 'success', message: 'Empleado desactivado correctamente', data: { id_empleado: id } });
  } catch (err) {
    next(err);
  }
};

export default null;
