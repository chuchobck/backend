//Módulo F4 - Gestión de Clientes
import prisma from '../config/database.js';

/**
 * GET /api/v1/clientes
 * F4.4.1 - Consulta general de clientes
 */
export const listarClientes = async (req, res, next) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { estado: 'ACT' },
      include: { ciudad: true }
    });

    return res.json({
      status: 'success',
      message: 'Clientes obtenidos correctamente',
      data: clientes
    });
  } catch (err) {
    // E1: Desconexión de BD
    next(err);
  }
};

/**
 * GET /api/v1/clientes/buscar
 * F4.4.2 - Consulta de clientes por parámetros
 * Búsqueda unificada por: id, cédula, nombre o estado
 */
export const buscarClientes = async (req, res, next) => {
  try {
    const { id, nombre, cedula, estado } = req.query;

    // E5: Parámetros faltantes
    if (!id && !nombre && !cedula && !estado) {
      return res.status(400).json({
        status: 'error',
        message: 'Ingrese al menos un criterio de búsqueda (id, nombre, cedula o estado)',
        data: null
      });
    }

    // Si se busca por ID, usar findUnique
    if (id) {
      const cliente = await prisma.cliente.findUnique({
        where: { id_cliente: id },
        include: { ciudad: true }
      });

      if (!cliente) {
        return res.status(404).json({
          status: 'error',
          message: 'Cliente no encontrado',
          data: null
        });
      }

      return res.json({
        status: 'success',
        message: 'Cliente encontrado',
        data: cliente
      });
    }

    // Si se busca por cédula exacta, usar findUnique
    if (cedula && !nombre && !estado) {
      const cliente = await prisma.cliente.findUnique({
        where: { ruc_cedula: cedula },
        include: { ciudad: true }
      });

      if (!cliente) {
        return res.status(404).json({
          status: 'error',
          message: 'Cliente no encontrado',
          data: null
        });
      }

      return res.json({
        status: 'success',
        message: 'Cliente encontrado',
        data: cliente
      });
    }

    // Búsqueda con múltiples filtros
    const whereConditions = {};
    
    if (nombre) {
      whereConditions.nombre1 = { contains: nombre, mode: 'insensitive' };
    }
    
    if (cedula) {
      whereConditions.ruc_cedula = { contains: cedula };
    }
    
    if (estado) {
      whereConditions.estado = estado;
    }

    const clientes = await prisma.cliente.findMany({
      where: whereConditions,
      include: { ciudad: true }
    });

    // E6: Sin resultados
    if (clientes.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron clientes con los criterios especificados',
        data: []
      });
    }

    return res.json({
      status: 'success',
      message: 'Búsqueda completada',
      data: clientes
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/clientes
 * Ingresar clienteD
 */
export const crearCliente = async (req, res, next) => {
  try {
    const {
      id_cliente,
      nombre1,
      nombre2,
      apellido1,
      apellido2,
      ruc_cedula,
      telefono,
      celular,
      email,
      direccion,
      id_ciudad
    } = req.body;

    // E5: Datos obligatorios
    if (!id_cliente || !nombre1 || !apellido1 || !ruc_cedula || !id_ciudad) {
      return res.status(400).json({
        status: 'error',
        message: 'Campos obligatorios faltantes',
        data: null
      });
    }

    await prisma.cliente.create({
      data: {
        id_cliente,
        nombre1,
        nombre2,
        apellido1,
        apellido2,
        ruc_cedula,
        telefono,
        celular,
        email,
        direccion,
        id_ciudad,
        estado: 'ACT'
      }
    });

    return res.status(201).json({
      status: 'success',
      message: 'Cliente creado correctamente',
      data: null
    });
  } catch (err) {
    next(err);
  }
};
/**
 * PUT /api/v1/clientes/:id
 * Actualizar cliente
 */
export const actualizarCliente = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: id }
    });

    if (!cliente) {
      return res.status(404).json({
        status: 'error',
        message: 'Cliente no existe',
        data: null
      });
    }

    await prisma.cliente.update({
      where: { id_cliente: id },
      data: req.body
    });

    res.json({
      status: 'success',
      message: 'Cliente actualizado correctamente',
      data: null
    });
  } catch (err) {
    next(err);
  }
};


/**
 * DELETE /api/v1/clientes/:id
 * Eliminación lógica (estado → INA)
 */
export const eliminarCliente = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: id }
    });

    if (!cliente) {
      return res.status(404).json({
        status: 'error',
        message: 'Cliente no existe',
        data: null
      });
    }

    if (cliente.estado === 'INA') {
      return res.status(409).json({
        status: 'error',
        message: 'Cliente ya está inactivo',
        data: null
      });
    }

    await prisma.cliente.update({
      where: { id_cliente: id },
      data: { estado: 'INA' }
    });

    res.json({
      status: 'success',
      message: 'Cliente desactivado correctamente',
      data: null
    });
  } catch (err) {
    next(err);
  }
};
