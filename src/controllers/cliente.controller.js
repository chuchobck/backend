//Módulo F4 - Gestión de Clientes
import prisma from '../lib/prisma.js';

/**
 * Validar cédula ecuatoriana usando algoritmo Módulo 10
 * @param {string} cedula - Cédula a validar (10 dígitos)
 * @returns {boolean} - true si es válida, false si no
 */
function validarCedulaEcuatoriana(cedula) {
  // Verificar que tenga 10 dígitos
  if (cedula.length !== 10) return false;
  
  // Verificar que sean solo números
  if (!/^\d+$/.test(cedula)) return false;
  
  // Verificar que los dos primeros dígitos correspondan a una provincia válida (01-24)
  const provincia = parseInt(cedula.substring(0, 2));
  if (provincia < 1 || provincia > 24) return false;
  
  // Algoritmo Módulo 10
  const digitoVerificador = parseInt(cedula.charAt(9));
  let suma = 0;
  
  for (let i = 0; i < 9; i++) {
    let digito = parseInt(cedula.charAt(i));
    
    // Los dígitos en posiciones impares (0,2,4,6,8) se multiplican por 2
    if (i % 2 === 0) {
      digito *= 2;
      // Si el resultado es mayor a 9, se resta 9
      if (digito > 9) digito -= 9;
    }
    // Los dígitos en posiciones pares (1,3,5,7) se dejan igual
    
    suma += digito;
  }
  
  // Calcular el dígito verificador
  const residuo = suma % 10;
  const resultado = residuo === 0 ? 0 : 10 - residuo;
  
  return resultado === digitoVerificador;
}

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
 * F4.1 - Ingreso de cliente
 * Caso de uso completo con todas las validaciones
 */
export const crearCliente = async (req, res, next) => {
  try {
    const {
      nombre1,
      nombre2,
      apellido1,
      apellido2,
      ruc_cedula,
      telefono,
      email,
      direccion,
      id_ciudad,
      origen,
      id_usuario
    } = req.body;

    // E4: Validar campos obligatorios
    if (!nombre1 || !apellido1 || !ruc_cedula) {
      return res.status(400).json({
        status: 'error',
        message: 'Complete todos los campos requeridos',
        data: null
      });
    }

    // E3: Validar cédula ecuatoriana
    if (!validarCedulaEcuatoriana(ruc_cedula)) {
      return res.status(400).json({
        status: 'error',
        message: 'La cédula ingresada no es válida',
        data: null
      });
    }

    // E2: Verificar si la cédula ya está registrada
    const clienteExiste = await prisma.cliente.findUnique({
      where: { ruc_cedula }
    });

    if (clienteExiste) {
      return res.status(409).json({
        status: 'error',
        message: 'La cédula ya está registrada',
        data: null
      });
    }

    // Validar ciudad si se proporciona
    if (id_ciudad) {
      const ciudadExiste = await prisma.ciudad.findUnique({
        where: { id_ciudad }
      });

      if (!ciudadExiste) {
        return res.status(404).json({
          status: 'error',
          message: 'La ciudad especificada no existe',
          data: null
        });
      }
    }

    // Crear el cliente con estado activo
    const nuevoCliente = await prisma.cliente.create({
      data: {
        nombre1,
        nombre2: nombre2 || null,
        apellido1,
        apellido2: apellido2 || null,
        ruc_cedula,
        telefono: telefono || null,
        email: email || null,
        direccion: direccion || null,
        id_ciudad: id_ciudad || null,
        origen: origen || 'POS',
        estado: 'ACT',
        id_usuario: id_usuario || null
      },
      include: {
        ciudad: true
      }
    });

    // Paso 7: Mensaje de confirmación
    return res.status(201).json({
      status: 'success',
      message: 'Cliente registrado exitosamente',
      data: nuevoCliente
    });
  } catch (err) {
    // E1: Error de conexión con base de datos
    if (err.code === 'P2002') {
      return res.status(409).json({
        status: 'error',
        message: 'La cédula ya está registrada',
        data: null
      });
    }
    
    console.error('Error al crear cliente:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Error de conexión con la base de datos',
      data: null
    });
  }
};
/**
 * PUT /api/v1/clientes/:id
 * Actualizar cliente
 */
export const actualizarCliente = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

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
    const id = parseInt(req.params.id, 10);

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
