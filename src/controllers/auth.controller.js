// src/controllers/auth.controller.js
import prisma from '../lib/prisma.js';
import { generarToken } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

/**
 * POST /api/v1/auth/login
 */
export const login = async (req, res, next) => {
  try {
    let { usuario: usuarioInput, password } = req.body;

    console.log('Login attempt:', { usuario: usuarioInput, hasPassword: !!password });

    if (!usuarioInput || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Usuario y contraseña son requeridos',
        data: null
      });
    }

    const usuarioNormalized = usuarioInput.toLowerCase().trim();

    console.log('🔍 Buscando usuario:', usuarioNormalized);

    // Buscar usuario con sus relaciones
    const usuario = await prisma.usuario.findUnique({
      where: { usuario: usuarioNormalized },
      include: {
        cliente: true,
        empleado: {
          include: { rol: true }
        }
      }
    });

    if (!usuario || usuario.estado !== 'ACT') {
      console.log(' Usuario no encontrado o inactivo');
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas',
        data: null
      });
    }

    if (!usuario.password_hash) {
      console.log(' Usuario sin password_hash');
      return res.status(403).json({
        status: 'error',
        message: 'Usuario no habilitado para login web',
        data: null
      });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValido) {
      console.log(' Contraseña inválida');
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas',
        data: null
      });
    }

    console.log(' Login exitoso para:', usuarioNormalized);

    // Actualizar último acceso
    await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: { ultimo_acceso: new Date() }
    });

    // Determinar tipo de usuario y rol
    const esEmpleado = !!usuario.empleado;
    const esCliente = !!usuario.cliente;
    
    const tipoUsuario = esEmpleado ? 'EMPLEADO' : 'CLIENTE';
    const rol = esEmpleado ? usuario.empleado.rol.codigo : 'CLIENTE';

    const token = generarToken({
      id: usuario.id_usuario,
      rol: rol,
      tipo: tipoUsuario,
      id_cliente: usuario.cliente?.id_cliente || null,
      id_empleado: usuario.empleado?.id_empleado || null
    });

    res.json({
      status: 'success',
      message: 'Login exitoso',
      data: {
        token,
        usuario: {
          id_usuario: usuario.id_usuario,
          usuario: usuario.usuario,
          rol: rol,
          tipo_usuario: tipoUsuario,
          // Datos según tipo
          ...(esCliente && {
            cliente: {
              id_cliente: usuario.cliente.id_cliente,
              nombre: `${usuario.cliente.nombre1} ${usuario.cliente.apellido1}`,
              nombre1: usuario.cliente.nombre1,
              apellido1: usuario.cliente.apellido1,
              ruc_cedula: usuario.cliente.ruc_cedula,
              email: usuario.cliente.email
            }
          }),
          ...(esEmpleado && {
            empleado: {
              id_empleado: usuario.empleado.id_empleado,
              nombre: `${usuario.empleado.nombre1} ${usuario.empleado.apellido1}`
            }
          })
        }
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    next(err);
  }
};

/**
 * POST /api/v1/auth/registro
 * Solo para clientes (e-commerce)
 */
export const registro = async (req, res, next) => {
  try {
    const {
      nombre1,
      nombre2,
      apellido1,
      apellido2,
      ruc_cedula,
      telefono,
      usuario: usuarioInput,
      password,
      direccion,
      id_ciudad,
      email
    } = req.body;

    // Validaciones
    if (!nombre1 || !apellido1 || !ruc_cedula || !usuarioInput || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Campos obligatorios: nombre1, apellido1, ruc_cedula, usuario, password',
        data: null
      });
    }

    const usuarioNormalized = usuarioInput.toLowerCase().trim();

    // Verificar usuario único
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { usuario: usuarioNormalized }
    });

    if (usuarioExistente) {
      return res.status(409).json({
        status: 'error',
        message: 'El nombre de usuario ya está registrado',
        data: null
      });
    }

    // Verificar RUC/Cédula único
    const clienteExistente = await prisma.cliente.findUnique({
      where: { ruc_cedula }
    });

    if (clienteExistente) {
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe un cliente con este RUC/Cédula',
        data: null
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Transacción: crear usuario y cliente
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear usuario
      const nuevoUsuario = await tx.usuario.create({
        data: {
          usuario: usuarioNormalized,
          password_hash: passwordHash,
          estado: 'ACT'
        }
      });

      // 2. Crear cliente vinculado al usuario
      const nuevoCliente = await tx.cliente.create({
        data: {
          id_usuario: nuevoUsuario.id_usuario,
          nombre1,
          nombre2: nombre2 || null,
          apellido1,
          apellido2: apellido2 || null,
          ruc_cedula,
          telefono: telefono || null,
          email: email || null,
          direccion: direccion || null,
          id_ciudad: id_ciudad || null,
          origen: 'WEB', // Registrado desde e-commerce
          estado: 'ACT'
        }
      });

      return { usuario: nuevoUsuario, cliente: nuevoCliente };
    });

    // Generar token
    const token = generarToken({
      id: resultado.usuario.id_usuario,
      rol: 'CLIENTE',
      tipo: 'CLIENTE',
      id_cliente: resultado.cliente.id_cliente,
      id_empleado: null
    });

    return res.status(201).json({
      status: 'success',
      message: 'Registro exitoso',
      data: {
        token,
        usuario: {
          id_usuario: resultado.usuario.id_usuario,
          usuario: resultado.usuario.usuario,
          rol: 'CLIENTE',
          tipo_usuario: 'CLIENTE',
          cliente: {
            id_cliente: resultado.cliente.id_cliente,
            nombre: `${resultado.cliente.nombre1} ${resultado.cliente.apellido1}`,
            nombre1: resultado.cliente.nombre1,
            apellido1: resultado.cliente.apellido1,
            ruc_cedula: resultado.cliente.ruc_cedula,
            email: resultado.cliente.email
          }
        }
      }
    });
  } catch (err) {
    console.error('Registro error:', err);
    next(err);
  }
};

/**
 * GET /api/v1/auth/perfil
 */
export const perfil = async (req, res, next) => {
  try {
    const { id } = req.usuario;

    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: id },
      include: {
        cliente: {
          include: { ciudad: true }
        },
        empleado: {
          include: { 
            rol: true
          }
        }
      }
    });

    if (!usuario) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado',
        data: null
      });
    }

    const esEmpleado = !!usuario.empleado;

    res.json({
      status: 'success',
      message: 'Perfil obtenido',
      data: {
        id_usuario: usuario.id_usuario,
        usuario: usuario.usuario,
        tipo_usuario: esEmpleado ? 'EMPLEADO' : 'CLIENTE',
        rol: esEmpleado ? usuario.empleado.rol.codigo : 'CLIENTE',
        ...(usuario.cliente && { cliente: usuario.cliente }),
        ...(usuario.empleado && { empleado: usuario.empleado })
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/auth/perfil
 */
export const actualizarPerfil = async (req, res, next) => {
  try {
    const { id } = req.usuario;
    const { nombre1, nombre2, apellido1, apellido2, telefono, direccion, id_ciudad } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: id },
      include: { cliente: true }
    });

    if (!usuario?.cliente) {
      return res.status(404).json({
        status: 'error',
        message: 'No tiene perfil de cliente asociado',
        data: null
      });
    }

    const datosActualizar = {};
    if (nombre1 !== undefined) datosActualizar.nombre1 = nombre1;
    if (nombre2 !== undefined) datosActualizar.nombre2 = nombre2;
    if (apellido1 !== undefined) datosActualizar.apellido1 = apellido1;
    if (apellido2 !== undefined) datosActualizar.apellido2 = apellido2;
    if (telefono !== undefined) datosActualizar.telefono = telefono;
    if (direccion !== undefined) datosActualizar.direccion = direccion;
    if (id_ciudad !== undefined) datosActualizar.id_ciudad = id_ciudad;

    const clienteActualizado = await prisma.cliente.update({
      where: { id_cliente: usuario.cliente.id_cliente },
      data: datosActualizar,
      include: { ciudad: true }
    });

    res.json({
      status: 'success',
      message: 'Perfil actualizado',
      data: { cliente: clienteActualizado }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/auth/cambiar-password
 */
export const cambiarPassword = async (req, res, next) => {
  try {
    const { id } = req.usuario;
    const { passwordActual, passwordNueva } = req.body;

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({
        status: 'error',
        message: 'Contraseña actual y nueva son requeridas',
        data: null
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: id }
    });

    if (!usuario) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado',
        data: null
      });
    }

    const valida = await bcrypt.compare(passwordActual, usuario.password_hash);

    if (!valida) {
      return res.status(401).json({
        status: 'error',
        message: 'Contraseña actual incorrecta',
        data: null
      });
    }

    const nuevaHash = await bcrypt.hash(passwordNueva, 10);

    await prisma.usuario.update({
      where: { id_usuario: id },
      data: { password_hash: nuevaHash }
    });

    res.json({
      status: 'success',
      message: 'Contraseña actualizada',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

export default {
  login,
  registro,
  perfil,
  actualizarPerfil,
  cambiarPassword
};