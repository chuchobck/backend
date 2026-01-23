// src/controllers/proveedor.controller.js
// 🔵 PERSONA 1: Módulo F1 - Gestión de Proveedores
import prisma from '../lib/prisma.js';

/**
 * Validar cédula ecuatoriana
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
 */
function validarRucEcuatoriano(ruc) {
  if (ruc.length !== 13) return false;
  if (!/^\d+$/.test(ruc)) return false;
  
  const cedula = ruc.substring(0, 10);
  if (!validarCedulaEcuatoriana(cedula)) return false;
  
  const establecimiento = ruc.substring(10, 13);
  return establecimiento === '001';
}

/**
 * Validar cédula o RUC
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
 */
function validarTelefono(telefono) {
  const tel = telefono.replace(/[\s-]/g, '');
  if (/^09\d{8}$/.test(tel)) return true; // Celular
  if (/^0[2-7]\d{7}$/.test(tel)) return true; // Fijo
  return false;
}

/**
 * GET /api/v1/proveedores
 * F1.4.1 - Consulta general de proveedores
 */
export const listarProveedores = async (req, res, next) => {
  try {
    const proveedores = await prisma.proveedor.findMany({
      where: { estado: 'ACT' },
      include: { 
        ciudad: true,
        _count: {
          select: {
            compra: true
          }
        }
      },
      orderBy: { razon_social: 'asc' }
    });

    res.json({
      status: 'success',
      message: `${proveedores.length} proveedores activos encontrados`,
      data: proveedores
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/proveedores/:id
 * Obtener proveedor por ID
 */
export const obtenerProveedor = async (req, res, next) => {
  try {
    const id = req.params.id; // STRING, no número

    if (!id || id.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de proveedor inválido',
        data: null
      });
    }

    const proveedor = await prisma.proveedor.findUnique({
      where: { id_proveedor: id.trim() },
      include: { 
        ciudad: true,
        _count: {
          select: {
            compra: true
          }
        }
      }
    });

    if (!proveedor) {
      return res.status(404).json({
        status: 'error',
        message: 'Proveedor no encontrado',
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
    const { ruc_cedula, razon_social, id_ciudad, estado } = req.query;

    if (!ruc_cedula && !razon_social && !id_ciudad && !estado) {
      return res.status(400).json({
        status: 'error',
        message: 'Ingrese al menos un criterio de búsqueda (ruc_cedula, razon_social, id_ciudad, estado)',
        data: null
      });
    }

    const whereConditions = {};

    // Búsqueda EXACTA de RUC/cédula por seguridad
    if (ruc_cedula) {
      whereConditions.ruc_cedula = ruc_cedula.trim();
    }

    // Búsqueda parcial de razón social
    if (razon_social) {
      whereConditions.razon_social = { 
        contains: razon_social, 
        mode: 'insensitive' 
      };
    }

    // Búsqueda por ciudad (STRING, no número)
    if (id_ciudad) {
      whereConditions.id_ciudad = id_ciudad.trim().toUpperCase();
    }

    // Búsqueda por estado
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

    const proveedores = await prisma.proveedor.findMany({
      where: whereConditions,
      include: { 
        ciudad: true,
        _count: {
          select: {
            compra: true
          }
        }
      },
      orderBy: { razon_social: 'asc' }
    });

    if (proveedores.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron proveedores con los criterios especificados',
        data: []
      });
    }

    res.json({
      status: 'success',
      message: `${proveedores.length} proveedor(es) encontrado(s)`,
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
    const { ruc_cedula, razon_social, direccion, telefono, email, id_ciudad } = req.body;

    // Validar campos obligatorios
    if (!ruc_cedula || !razon_social || !id_ciudad) {
      return res.status(400).json({
        status: 'error',
        message: 'ruc_cedula, razon_social y id_ciudad son requeridos',
        data: null
      });
    }

    // Validar longitud de razón social
    if (razon_social.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'La razón social no puede estar vacía',
        data: null
      });
    }

    if (razon_social.trim().length > 200) {
      return res.status(400).json({
        status: 'error',
        message: 'La razón social no puede exceder 200 caracteres',
        data: null
      });
    }

    // Validar RUC/cédula
    const validacion = validarDocumento(ruc_cedula);
    if (!validacion.valido) {
      return res.status(400).json({
        status: 'error',
        message: `La ${validacion.tipo === 'cedula' ? 'cédula' : validacion.tipo === 'ruc' ? 'RUC' : 'cédula/RUC'} ingresada no es válida`,
        data: null
      });
    }

    // Verificar duplicados
    const proveedorExistente = await prisma.proveedor.findUnique({
      where: { ruc_cedula: ruc_cedula.trim() }
    });

    if (proveedorExistente) {
      return res.status(409).json({
        status: 'error',
        message: 'El RUC/cédula ya está registrado',
        data: { proveedor_existente: proveedorExistente.id_proveedor }
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

    // Validar ciudad (STRING CHAR(3))
    const ciudadUpper = id_ciudad.trim().toUpperCase();
    
    if (ciudadUpper.length !== 3) {
      return res.status(400).json({
        status: 'error',
        message: 'El código de ciudad debe tener exactamente 3 caracteres',
        data: null
      });
    }

    const ciudad = await prisma.ciudad.findUnique({
      where: { id_ciudad: ciudadUpper }
    });

    if (!ciudad) {
      return res.status(404).json({
        status: 'error',
        message: 'La ciudad especificada no existe',
        data: null
      });
    }

    // Crear proveedor (id_proveedor se genera automáticamente)
    const proveedor = await prisma.proveedor.create({
      data: {
        ruc_cedula: ruc_cedula.trim(),
        razon_social: razon_social.trim(),
        direccion: direccion?.trim() || null,
        telefono: telefono?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        id_ciudad: ciudadUpper,
        estado: 'ACT'
      },
      include: {
        ciudad: true
      }
    });

    res.status(201).json({
      status: 'success',
      message: `Proveedor creado correctamente (${validacion.tipo === 'cedula' ? 'Cédula' : 'RUC'})`,
      data: proveedor
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        status: 'error',
        message: 'El RUC/cédula ya está registrado',
        data: null
      });
    }
    next(err);
  }
};

/**
 * PUT /api/v1/proveedores/:id
 * F1.2 - Actualización de proveedor
 */
export const actualizarProveedor = async (req, res, next) => {
  try {
    const id = req.params.id; // STRING, no número
    const { razon_social, direccion, telefono, email, id_ciudad } = req.body;

    if (!id || id.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de proveedor inválido',
        data: null
      });
    }

    // Verificar que existe
    const proveedor = await prisma.proveedor.findUnique({
      where: { id_proveedor: id.trim() }
    });

    if (!proveedor) {
      return res.status(404).json({
        status: 'error',
        message: 'Proveedor no encontrado',
        data: null
      });
    }

    // Construir objeto de actualización solo con campos permitidos
    const dataToUpdate = {};

    if (razon_social !== undefined) {
      if (razon_social.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'La razón social no puede estar vacía',
          data: null
        });
      }

      if (razon_social.trim().length > 200) {
        return res.status(400).json({
          status: 'error',
          message: 'La razón social no puede exceder 200 caracteres',
          data: null
        });
      }

      dataToUpdate.razon_social = razon_social.trim();
    }

    if (direccion !== undefined) {
      dataToUpdate.direccion = direccion?.trim() || null;
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

    if (id_ciudad !== undefined) {
      const ciudadUpper = id_ciudad.trim().toUpperCase();

      if (ciudadUpper.length !== 3) {
        return res.status(400).json({
          status: 'error',
          message: 'El código de ciudad debe tener exactamente 3 caracteres',
          data: null
        });
      }

      const ciudad = await prisma.ciudad.findUnique({
        where: { id_ciudad: ciudadUpper }
      });

      if (!ciudad) {
        return res.status(404).json({
          status: 'error',
          message: 'La ciudad especificada no existe',
          data: null
        });
      }

      dataToUpdate.id_ciudad = ciudadUpper;
    }

    // Actualizar
    const actualizado = await prisma.proveedor.update({
      where: { id_proveedor: id.trim() },
      data: dataToUpdate,
      include: {
        ciudad: true,
        _count: {
          select: {
            compra: true
          }
        }
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
    const id = req.params.id; // STRING, no número

    if (!id || id.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de proveedor inválido',
        data: null
      });
    }

    const proveedor = await prisma.proveedor.findUnique({
      where: { id_proveedor: id.trim() },
      include: {
        _count: {
          select: {
            compra: true
          }
        }
      }
    });

    if (!proveedor) {
      return res.status(404).json({
        status: 'error',
        message: 'Proveedor no encontrado',
        data: null
      });
    }

    if (proveedor.estado === 'INA') {
      return res.status(400).json({
        status: 'error',
        message: 'El proveedor ya se encuentra inactivo',
        data: null
      });
    }

    // Información sobre relaciones
    let advertencia = null;
    if (proveedor._count.compra > 0) {
      advertencia = `El proveedor tiene ${proveedor._count.compra} compra(s) asociada(s)`;
    }

    await prisma.proveedor.update({
      where: { id_proveedor: id.trim() },
      data: { estado: 'INA' }
    });

    res.json({
      status: 'success',
      message: 'Proveedor desactivado correctamente',
      data: null,
      advertencia
    });
  } catch (err) {
    next(err);
  }
};
