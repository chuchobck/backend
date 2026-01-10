// src/controllers/metodo-pago.controller.js
// CRUD para gestión de Métodos de Pago

import prisma from '../lib/prisma.js';

/**
 * GET /api/v1/metodos-pago
 * Listar todos los métodos de pago activos
 */
export const listarMetodosPago = async (req, res, next) => {
  try {
    const metodos = await prisma.metodo_pago.findMany({
      where: { estado: 'ACT' },
      orderBy: { nombre: 'asc' }
    });

    if (metodos.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No existen métodos de pago registrados',
        data: []
      });
    }

    res.json({
      status: 'success',
      message: 'Métodos de pago obtenidos correctamente',
      data: metodos
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/metodos-pago/:id
 * Obtener un método de pago por ID
 */
export const obtenerMetodoPago = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de método de pago inválido',
        data: null
      });
    }

    const metodo = await prisma.metodo_pago.findUnique({
      where: { id_metodo_pago: id }
    });

    if (!metodo) {
      return res.status(404).json({
        status: 'error',
        message: 'Método de pago no encontrado',
        data: null
      });
    }

    res.json({
      status: 'success',
      message: 'Método de pago obtenido correctamente',
      data: metodo
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/metodos-pago/buscar
 * Buscar métodos de pago con filtros opcionales
 */
export const buscarMetodosPago = async (req, res, next) => {
  try {
    const { codigo, nombre, disponible_pos, disponible_web, estado } = req.query;

    // Validar que al menos un criterio de búsqueda fue proporcionado
    if (!codigo && !nombre && !disponible_pos && !disponible_web && !estado) {
      return res.status(400).json({
        status: 'error',
        message: 'Ingrese al menos un criterio de búsqueda',
        data: null
      });
    }

    // Construir objeto de filtros dinámicamente
    const whereClause = {};

    if (codigo) {
      whereClause.codigo = codigo;
    }

    if (nombre) {
      whereClause.nombre = {
        contains: nombre,
        mode: 'insensitive'
      };
    }

    if (disponible_pos !== undefined) {
      whereClause.disponible_pos = disponible_pos === 'true' || disponible_pos === true;
    }

    if (disponible_web !== undefined) {
      whereClause.disponible_web = disponible_web === 'true' || disponible_web === true;
    }

    if (estado) {
      whereClause.estado = estado;
    }

    const metodos = await prisma.metodo_pago.findMany({
      where: whereClause,
      orderBy: { nombre: 'asc' }
    });

    if (metodos.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron métodos de pago con los criterios especificados',
        data: []
      });
    }

    res.json({
      status: 'success',
      message: 'Búsqueda completada',
      data: metodos
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/metodos-pago
 * Crear un nuevo método de pago
 */
export const crearMetodoPago = async (req, res, next) => {
  try {
    const { codigo, nombre, disponible_pos, disponible_web, requiere_referencia } = req.body;

    // Validaciones
    if (!codigo || codigo.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Código del método de pago es requerido',
        data: null
      });
    }

    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Nombre del método de pago es requerido',
        data: null
      });
    }

    // Verificar que el código no exista
    const metodoExistente = await prisma.metodo_pago.findUnique({
      where: { codigo: codigo.trim() }
    });

    if (metodoExistente) {
      return res.status(409).json({
        status: 'error',
        message: 'El código del método de pago ya existe',
        data: null
      });
    }

    // Crear el método de pago
    const nuevoMetodo = await prisma.metodo_pago.create({
      data: {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        disponible_pos: disponible_pos !== undefined ? Boolean(disponible_pos) : true,
        disponible_web: disponible_web !== undefined ? Boolean(disponible_web) : true,
        requiere_referencia: requiere_referencia !== undefined ? Boolean(requiere_referencia) : false,
        estado: 'ACT'
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Método de pago creado correctamente',
      data: nuevoMetodo
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/metodos-pago/:id
 * Actualizar un método de pago (solo nombre y flags, no codigo)
 */
export const actualizarMetodoPago = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { nombre, disponible_pos, disponible_web, requiere_referencia } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de método de pago inválido',
        data: null
      });
    }

    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Nombre del método de pago es requerido',
        data: null
      });
    }

    // Verificar que el método existe
    const metodo = await prisma.metodo_pago.findUnique({
      where: { id_metodo_pago: id }
    });

    if (!metodo) {
      return res.status(404).json({
        status: 'error',
        message: 'Método de pago no encontrado',
        data: null
      });
    }

    // Actualizar el método (sin permitir cambiar el código)
    const metodoActualizado = await prisma.metodo_pago.update({
      where: { id_metodo_pago: id },
      data: {
        nombre: nombre.trim(),
        disponible_pos: disponible_pos !== undefined ? Boolean(disponible_pos) : metodo.disponible_pos,
        disponible_web: disponible_web !== undefined ? Boolean(disponible_web) : metodo.disponible_web,
        requiere_referencia: requiere_referencia !== undefined ? Boolean(requiere_referencia) : metodo.requiere_referencia
      }
    });

    res.json({
      status: 'success',
      message: 'Método de pago actualizado correctamente',
      data: metodoActualizado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/metodos-pago/:id
 * Eliminar (desactivar) un método de pago
 */
export const eliminarMetodoPago = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de método de pago inválido',
        data: null
      });
    }

    // Verificar que el método existe
    const metodo = await prisma.metodo_pago.findUnique({
      where: { id_metodo_pago: id }
    });

    if (!metodo) {
      return res.status(404).json({
        status: 'error',
        message: 'Método de pago no encontrado',
        data: null
      });
    }

    // Validar que NO esté ya inactivo
    if (metodo.estado === 'INA') {
      return res.status(400).json({
        status: 'error',
        message: 'El método de pago ya se encuentra desactivado',
        data: null
      });
    }

    // Actualizar estado a INA
    const metodoDesactivado = await prisma.metodo_pago.update({
      where: { id_metodo_pago: id },
      data: { estado: 'INA' }
    });

    res.json({
      status: 'success',
      message: 'Método de pago desactivado correctamente',
      data: metodoDesactivado
    });
  } catch (err) {
    next(err);
  }
};
