//Módulo F4 - Gestión de Clientes
import prisma from '../lib/prisma.js';

/**
 * Validar cédula ecuatoriana usando algoritmo Módulo 10
 * @param {string} cedula - Cédula a validar (10 dígitos)
 * @returns {boolean} - true si es válida, false si no
 */
function validarCedulaEcuatoriana(cedula) {
  if (cedula.length !== 10) return false;
  if (!/^\d+$/.test(cedula)) return false;
  
  const provincia = parseInt(cedula.substring(0, 2));
  if (provincia < 1 || provincia > 24) return false;
  
  const digitoVerificador = parseInt(cedula.charAt(9));
  let suma = 0;
  
  for (let i = 0; i < 9; i++) {
    let digito = parseInt(cedula.charAt(i));
    if (i % 2 === 0) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    suma += digito;
  }
  
  const residuo = suma % 10;
  const resultado = residuo === 0 ? 0 : 10 - residuo;
  
  return resultado === digitoVerificador;
}

/**
 * Validar RUC ecuatoriano
 * @param {string} ruc - RUC a validar (13 dígitos)
 * @returns {boolean} - true si es válido, false si no
 */
function validarRucEcuatoriano(ruc) {
  if (ruc.length !== 13) return false;
  if (!/^\d+$/.test(ruc)) return false;
  
  // Los primeros 10 dígitos deben ser una cédula válida
  const cedula = ruc.substring(0, 10);
  if (!validarCedulaEcuatoriana(cedula)) return false;
  
  // Los últimos 3 dígitos deben ser 001 para personas naturales
  const establecimiento = ruc.substring(10, 13);
  return establecimiento === '001';
}

/**
 * Validar cédula o RUC
 * @param {string} documento - Cédula (10) o RUC (13)
 * @returns {object} - { valido: boolean, tipo: 'cedula'|'ruc'|null }
 */
function validarDocumento(documento) {
  const docTrim = documento.trim();
  
  if (docTrim.length === 10) {
    return {
      valido: validarCedulaEcuatoriana(docTrim),
      tipo: 'cedula'
    };
  }
  
  if (docTrim.length === 13) {
    return {
      valido: validarRucEcuatoriano(docTrim),
      tipo: 'ruc'
    };
  }
  
  return { valido: false, tipo: null };
}

/**
 * Validar email
 */
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validar teléfono ecuatoriano
 * Formatos válidos: 0987654321 (celular), 022345678 (fijo)
 */
function validarTelefono(telefono) {
  // Eliminar espacios y guiones
  const tel = telefono.replace(/[\s-]/g, '');
  
  // Celular: 09 o 10 dígitos empezando con 09
  if (/^09\d{8}$/.test(tel)) return true;
  
  // Fijo: 9 dígitos empezando con 02-07
  if (/^0[2-7]\d{7}$/.test(tel)) return true;
  
  return false;
}

/**
 * GET /api/v1/clientes
 * F4.4.1 - Consulta general de clientes
 */
export const listarClientes = async (req, res, next) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { estado: 'ACT' },
      include: { 
        ciudad: true,
        _count: {
          select: {
            factura: true,
            carrito: true,
            producto_favorito: true
          }
        }
      },
      orderBy: [
        { apellido1: 'asc' },
        { apellido2: 'asc' },
        { nombre1: 'asc' }
      ]
    });

    return res.json({
      status: 'success',
      message: `${clientes.length} clientes activos encontrados`,
      data: clientes
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/clientes/buscar
 * F4.4.2 - Consulta de clientes por parámetros
 */
export const buscarClientes = async (req, res, next) => {
  try {
    const { id, nombre, cedula, estado } = req.query;

    if (!id && !nombre && !cedula && !estado) {
      return res.status(400).json({
        status: 'error',
        message: 'Ingrese al menos un criterio de búsqueda (id, nombre, cedula o estado)',
        data: null
      });
    }

    // Búsqueda por ID (exacta)
    if (id) {
      const idNum = parseInt(id);
      if (isNaN(idNum)) {
        return res.status(400).json({
          status: 'error',
          message: 'ID inválido',
          data: null
        });
      }

      const cliente = await prisma.cliente.findUnique({
        where: { id_cliente: idNum },
        include: { 
          ciudad: true,
          _count: {
            select: {
              factura: true,
              carrito: true,
              producto_favorito: true
            }
          }
        }
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

    // Búsqueda por cédula EXACTA (seguridad)
    if (cedula && !nombre && !estado) {
      const cliente = await prisma.cliente.findUnique({
        where: { ruc_cedula: cedula.trim() },
        include: { 
          ciudad: true,
          _count: {
            select: {
              factura: true,
              carrito: true,
              producto_favorito: true
            }
          }
        }
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
      // Buscar en todos los campos de nombre
      whereConditions.OR = [
        { nombre1: { contains: nombre, mode: 'insensitive' } },
        { nombre2: { contains: nombre, mode: 'insensitive' } },
        { apellido1: { contains: nombre, mode: 'insensitive' } },
        { apellido2: { contains: nombre, mode: 'insensitive' } }
      ];
    }
    
    // Solo búsqueda EXACTA de cédula por seguridad
    if (cedula) {
      whereConditions.ruc_cedula = cedula.trim();
    }
    
    if (estado) {
      if (!['ACT', 'INA'].includes(estado)) {
        return res.status(400).json({
          status: 'error',
          message: 'Estado inválido. Use "ACT" o "INA"',
          data: null
        });
      }
      whereConditions.estado = estado;
    }

    const clientes = await prisma.cliente.findMany({
      where: whereConditions,
      include: { 
        ciudad: true,
        _count: {
          select: {
            factura: true,
            carrito: true,
            producto_favorito: true
          }
        }
      },
      orderBy: [
        { apellido1: 'asc' },
        { nombre1: 'asc' }
      ]
    });

    if (clientes.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron clientes con los criterios especificados',
        data: []
      });
    }

    return res.json({
      status: 'success',
      message: `${clientes.length} cliente(s) encontrado(s)`,
      data: clientes
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/clientes
 * F4.1 - Ingreso de cliente
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

    // Validar campos obligatorios
    if (!nombre1 || !apellido1 || !ruc_cedula) {
      return res.status(400).json({
        status: 'error',
        message: 'nombre1, apellido1 y ruc_cedula son requeridos',
        data: null
      });
    }

    // Validar longitud de nombres
    if (nombre1.trim().length === 0 || apellido1.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Los nombres y apellidos no pueden estar vacíos',
        data: null
      });
    }

    // Validar cédula/RUC
    const validacion = validarDocumento(ruc_cedula);
    if (!validacion.valido) {
      return res.status(400).json({
        status: 'error',
        message: `La ${validacion.tipo === 'cedula' ? 'cédula' : validacion.tipo === 'ruc' ? 'RUC' : 'cédula/RUC'} ingresada no es válida`,
        data: null
      });
    }

    // Verificar duplicados
    const clienteExiste = await prisma.cliente.findUnique({
      where: { ruc_cedula: ruc_cedula.trim() }
    });

    if (clienteExiste) {
      return res.status(409).json({
        status: 'error',
        message: 'La cédula/RUC ya está registrada',
        data: { cliente_existente: clienteExiste.id_cliente }
      });
    }

    // Validar email si se proporciona
    if (email && !validarEmail(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'El formato del email es inválido',
        data: null
      });
    }

    // Validar teléfono si se proporciona
    if (telefono && !validarTelefono(telefono)) {
      return res.status(400).json({
        status: 'error',
        message: 'El formato del teléfono es inválido. Use formato ecuatoriano (ej: 0987654321)',
        data: null
      });
    }

    // Validar ciudad
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

    // Validar usuario si se proporciona
    if (id_usuario) {
      const usuarioExiste = await prisma.usuario.findUnique({
        where: { id_usuario: parseInt(id_usuario) }
      });

      if (!usuarioExiste) {
        return res.status(404).json({
          status: 'error',
          message: 'El usuario especificado no existe',
          data: null
        });
      }

      // Verificar que el usuario no tenga ya un cliente asociado
      const usuarioConCliente = await prisma.cliente.findUnique({
        where: { id_usuario: parseInt(id_usuario) }
      });

      if (usuarioConCliente) {
        return res.status(409).json({
          status: 'error',
          message: 'El usuario ya tiene un cliente asociado',
          data: null
        });
      }
    }

    // Validar origen
    if (origen && !['POS', 'WEB'].includes(origen)) {
      return res.status(400).json({
        status: 'error',
        message: 'Origen inválido. Use "POS" o "WEB"',
        data: null
      });
    }

    // Crear cliente
    const nuevoCliente = await prisma.cliente.create({
      data: {
        nombre1: nombre1.trim(),
        nombre2: nombre2?.trim() || null,
        apellido1: apellido1.trim(),
        apellido2: apellido2?.trim() || null,
        ruc_cedula: ruc_cedula.trim(),
        telefono: telefono?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        direccion: direccion?.trim() || null,
        id_ciudad: id_ciudad || null,
        origen: origen || 'POS',
        estado: 'ACT',
        id_usuario: id_usuario ? parseInt(id_usuario) : null
      },
      include: {
        ciudad: true,
        usuario: {
          select: {
            id_usuario: true,
            usuario: true,
            estado: true
          }
        }
      }
    });

    return res.status(201).json({
      status: 'success',
      message: `Cliente registrado exitosamente (${validacion.tipo === 'cedula' ? 'Cédula' : 'RUC'})`,
      data: nuevoCliente
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        status: 'error',
        message: 'La cédula/RUC ya está registrada',
        data: null
      });
    }
    next(err);
  }
};

/**
 * PUT /api/v1/clientes/:id
 * Actualizar cliente
 */
export const actualizarCliente = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de cliente inválido',
        data: null
      });
    }

    const {
      nombre1,
      nombre2,
      apellido1,
      apellido2,
      telefono,
      email,
      direccion,
      id_ciudad
    } = req.body;

    // Verificar que existe
    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: id }
    });

    if (!cliente) {
      return res.status(404).json({
        status: 'error',
        message: 'Cliente no encontrado',
        data: null
      });
    }

    // Construir objeto de actualización solo con campos permitidos
    const dataToUpdate = {};

    if (nombre1 !== undefined) {
      if (nombre1.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'El primer nombre no puede estar vacío',
          data: null
        });
      }
      dataToUpdate.nombre1 = nombre1.trim();
    }

    if (nombre2 !== undefined) {
      dataToUpdate.nombre2 = nombre2?.trim() || null;
    }

    if (apellido1 !== undefined) {
      if (apellido1.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'El primer apellido no puede estar vacío',
          data: null
        });
      }
      dataToUpdate.apellido1 = apellido1.trim();
    }

    if (apellido2 !== undefined) {
      dataToUpdate.apellido2 = apellido2?.trim() || null;
    }

    if (email !== undefined) {
      if (email && !validarEmail(email)) {
        return res.status(400).json({
          status: 'error',
          message: 'El formato del email es inválido',
          data: null
        });
      }
      dataToUpdate.email = email?.trim().toLowerCase() || null;
    }

    if (telefono !== undefined) {
      if (telefono && !validarTelefono(telefono)) {
        return res.status(400).json({
          status: 'error',
          message: 'El formato del teléfono es inválido',
          data: null
        });
      }
      dataToUpdate.telefono = telefono?.trim() || null;
    }

    if (direccion !== undefined) {
      dataToUpdate.direccion = direccion?.trim() || null;
    }

    if (id_ciudad !== undefined) {
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
      dataToUpdate.id_ciudad = id_ciudad || null;
    }

    // Actualizar
    const clienteActualizado = await prisma.cliente.update({
      where: { id_cliente: id },
      data: dataToUpdate,
      include: {
        ciudad: true,
        usuario: {
          select: {
            id_usuario: true,
            usuario: true,
            estado: true
          }
        }
      }
    });

    res.json({
      status: 'success',
      message: 'Cliente actualizado correctamente',
      data: clienteActualizado
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
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de cliente inválido',
        data: null
      });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: id },
      include: {
        _count: {
          select: {
            factura: true,
            carrito: true,
            producto_favorito: true
          }
        }
      }
    });

    if (!cliente) {
      return res.status(404).json({
        status: 'error',
        message: 'Cliente no encontrado',
        data: null
      });
    }

    if (cliente.estado === 'INA') {
      return res.status(400).json({
        status: 'error',
        message: 'El cliente ya está inactivo',
        data: null
      });
    }

    // Información sobre relaciones
    let advertencia = null;
    const totalRelaciones = cliente._count.factura + cliente._count.carrito + cliente._count.producto_favorito;
    
    if (totalRelaciones > 0) {
      advertencia = `El cliente tiene ${cliente._count.factura} factura(s), ${cliente._count.carrito} carrito(s) y ${cliente._count.producto_favorito} producto(s) favorito(s)`;
    }

    await prisma.cliente.update({
      where: { id_cliente: id },
      data: { estado: 'INA' }
    });

    res.json({
      status: 'success',
      message: 'Cliente desactivado correctamente',
      data: null,
      advertencia
    });
  } catch (err) {
    next(err);
  }
};
