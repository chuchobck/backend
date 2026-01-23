import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

/**
 * Validar cédula ecuatoriana usando algoritmo Módulo 10
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
 * Validar teléfono ecuatoriano
 */
function validarTelefono(telefono) {
  const tel = telefono.replace(/[\s-]/g, '');
  if (/^09\d{8}$/.test(tel)) return true; // Celular
  if (/^0[2-7]\d{7}$/.test(tel)) return true; // Fijo
  return false;
}

/**
 * GET /api/v1/empleados
 * Listar empleados activos
 */
export const listarEmpleados = async (req, res, next) => {
  try {
    const empleados = await prisma.empleado.findMany({
      where: { estado: 'ACT' },
      include: {
        usuario: { 
          select: { 
            id_usuario: true, 
            usuario: true, 
            estado: true 
          } 
        },
        rol: { 
          select: { 
            id_rol: true, 
            nombre: true, 
            codigo: true,
            descripcion: true
          } 
        },
        _count: {
          select: {
            factura: true,
            recepcion: true
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
      message: `${empleados.length} empleados activos encontrados`, 
      data: empleados 
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/empleados/:id
 * Obtener empleado por ID
 */
export const obtenerEmpleado = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'ID de empleado inválido', 
        data: null 
      });
    }

    const empleado = await prisma.empleado.findUnique({
      where: { id_empleado: id },
      include: { 
        usuario: {
          select: {
            id_usuario: true,
            usuario: true,
            estado: true,
            fecha_creacion: true,
            ultimo_acceso: true
          }
        },
        rol: true,
        _count: {
          select: {
            factura: true,
            recepcion: true
          }
        }
      }
    });

    if (!empleado) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Empleado no encontrado', 
        data: null 
      });
    }

    return res.json({ 
      status: 'success', 
      message: 'Empleado obtenido', 
      data: empleado 
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/empleados/buscar
 * Buscar empleados por criterios
 */
export const buscarEmpleados = async (req, res, next) => {
  try {
    const { cedula, nombre, id_rol, estado } = req.query;

    if (!cedula && !nombre && !id_rol && !estado) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Ingrese al menos un criterio de búsqueda (cedula, nombre, id_rol, estado)', 
        data: null 
      });
    }

    const where = {};
    
    // Búsqueda EXACTA de cédula por seguridad
    if (cedula) {
      where.cedula = cedula.trim();
    }
    
    // Búsqueda en todos los campos de nombre
    if (nombre) {
      where.OR = [
        { nombre1: { contains: nombre, mode: 'insensitive' } },
        { nombre2: { contains: nombre, mode: 'insensitive' } },
        { apellido1: { contains: nombre, mode: 'insensitive' } },
        { apellido2: { contains: nombre, mode: 'insensitive' } }
      ];
    }
    
    if (id_rol) {
      const rolNum = parseInt(id_rol);
      if (isNaN(rolNum)) {
        return res.status(400).json({
          status: 'error',
          message: 'id_rol debe ser un número válido',
          data: null
        });
      }
      where.id_rol = rolNum;
    }
    
    if (estado) {
      if (!['ACT', 'INA'].includes(estado)) {
        return res.status(400).json({
          status: 'error',
          message: 'Estado inválido. Use "ACT" o "INA"',
          data: null
        });
      }
      where.estado = estado;
    }

    const resultados = await prisma.empleado.findMany({
      where,
      include: { 
        usuario: {
          select: {
            id_usuario: true,
            usuario: true,
            estado: true
          }
        },
        rol: true,
        _count: {
          select: {
            factura: true,
            recepcion: true
          }
        }
      },
      orderBy: [
        { apellido1: 'asc' },
        { nombre1: 'asc' }
      ]
    });

    if (resultados.length === 0) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'No se encontraron empleados con los criterios especificados', 
        data: [] 
      });
    }

    return res.json({ 
      status: 'success', 
      message: `${resultados.length} empleado(s) encontrado(s)`, 
      data: resultados 
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/empleados
 * Crear empleado (con usuario automático)
 */
export const crearEmpleado = async (req, res, next) => {
  try {
    const { 
      cedula, 
      nombre1,
      nombre2,
      apellido1,
      apellido2,
      telefono, 
      id_rol, 
      usuario, 
      password 
    } = req.body;

    // Validar campos obligatorios
    if (!cedula || !nombre1 || !apellido1 || !id_rol || !usuario || !password) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'cedula, nombre1, apellido1, id_rol, usuario y password son requeridos', 
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

    // Validar cédula ecuatoriana
    if (!validarCedulaEcuatoriana(cedula)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'La cédula ingresada no es válida', 
        data: null 
      });
    }

    // Verificar unicidad de cédula
    const cedulaExist = await prisma.empleado.findUnique({ 
      where: { cedula: cedula.trim() } 
    });
    
    if (cedulaExist) {
      return res.status(409).json({ 
        status: 'error', 
        message: 'La cédula ya está registrada', 
        data: null 
      });
    }

    // Verificar unicidad de usuario
    const usuarioExist = await prisma.usuario.findUnique({ 
      where: { usuario: usuario.trim().toLowerCase() } 
    });
    
    if (usuarioExist) {
      return res.status(409).json({ 
        status: 'error', 
        message: 'El nombre de usuario ya está registrado', 
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

    // Validar rol existe
    const rol = await prisma.rol.findUnique({ 
      where: { id_rol: parseInt(id_rol) } 
    });
    
    if (!rol) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'El rol especificado no existe', 
        data: null 
      });
    }

    if (rol.estado !== 'ACT') {
      return res.status(400).json({
        status: 'error',
        message: 'El rol especificado no está activo',
        data: null
      });
    }

    // Validar contraseña
    if (password.length < 8) {
      return res.status(400).json({
        status: 'error',
        message: 'La contraseña debe tener al menos 8 caracteres',
        data: null
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Crear usuario y empleado en transacción
    const resultado = await prisma.$transaction(async (tx) => {
      const usuarioCreado = await tx.usuario.create({
        data: { 
          usuario: usuario.trim().toLowerCase(), 
          password_hash, 
          estado: 'ACT' 
        }
      });

      const empleadoCreado = await tx.empleado.create({
        data: {
          id_usuario: usuarioCreado.id_usuario,
          cedula: cedula.trim(),
          nombre1: nombre1.trim(),
          nombre2: nombre2?.trim() || null,
          apellido1: apellido1.trim(),
          apellido2: apellido2?.trim() || null,
          telefono: telefono?.trim() || null,
          id_rol: parseInt(id_rol),
          estado: 'ACT'
        },
        include: { 
          usuario: {
            select: {
              id_usuario: true,
              usuario: true,
              estado: true,
              fecha_creacion: true
            }
          },
          rol: true
        }
      });

      return empleadoCreado;
    });

    return res.status(201).json({ 
      status: 'success', 
      message: 'Empleado creado correctamente', 
      data: resultado 
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        status: 'error',
        message: 'La cédula o usuario ya está registrado',
        data: null
      });
    }
    next(err);
  }
};

/**
 * PUT /api/v1/empleados/:id
 * Actualizar empleado
 */
export const actualizarEmpleado = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { 
      nombre1,
      nombre2,
      apellido1,
      apellido2,
      telefono, 
      id_rol 
    } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'ID de empleado inválido', 
        data: null 
      });
    }

    // Verificar que existe
    const empleado = await prisma.empleado.findUnique({ 
      where: { id_empleado: id } 
    });
    
    if (!empleado) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Empleado no encontrado', 
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

    if (id_rol !== undefined) {
      const rolNum = parseInt(id_rol);
      if (isNaN(rolNum)) {
        return res.status(400).json({
          status: 'error',
          message: 'id_rol inválido',
          data: null
        });
      }

      const rol = await prisma.rol.findUnique({ 
        where: { id_rol: rolNum } 
      });
      
      if (!rol) {
        return res.status(404).json({ 
          status: 'error', 
          message: 'El rol especificado no existe', 
          data: null 
        });
      }

      if (rol.estado !== 'ACT') {
        return res.status(400).json({
          status: 'error',
          message: 'El rol especificado no está activo',
          data: null
        });
      }

      dataToUpdate.id_rol = rolNum;
    }

    const actualizado = await prisma.empleado.update({
      where: { id_empleado: id },
      data: dataToUpdate,
      include: { 
        usuario: {
          select: {
            id_usuario: true,
            usuario: true,
            estado: true
          }
        },
        rol: true
      }
    });

    return res.json({ 
      status: 'success', 
      message: 'Empleado actualizado correctamente', 
      data: actualizado 
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/empleados/:id
 * Eliminación lógica de empleado y su usuario
 */
export const eliminarEmpleado = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'ID de empleado inválido', 
        data: null 
      });
    }

    const empleado = await prisma.empleado.findUnique({ 
      where: { id_empleado: id },
      include: {
        _count: {
          select: {
            factura: true,
            recepcion: true
          }
        }
      }
    });
    
    if (!empleado) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Empleado no encontrado', 
        data: null 
      });
    }

    if (empleado.estado === 'INA') {
      return res.status(400).json({ 
        status: 'error', 
        message: 'El empleado ya está inactivo', 
        data: null 
      });
    }

    // Información sobre relaciones
    let advertencia = null;
    const totalRelaciones = empleado._count.factura + empleado._count.recepcion;
    
    if (totalRelaciones > 0) {
      advertencia = `El empleado tiene ${empleado._count.factura} factura(s) y ${empleado._count.recepcion} recepción(es) asociadas`;
    }

    // Desactivar empleado y usuario en transacción
    await prisma.$transaction([
      prisma.empleado.update({ 
        where: { id_empleado: id }, 
        data: { estado: 'INA' } 
      }),
      prisma.usuario.update({ 
        where: { id_usuario: empleado.id_usuario }, 
        data: { estado: 'INA' } 
      })
    ]);

    return res.json({ 
      status: 'success', 
      message: 'Empleado y usuario desactivados correctamente', 
      data: { id_empleado: id },
      advertencia
    });
  } catch (err) {
    next(err);
  }
};

export default null;
