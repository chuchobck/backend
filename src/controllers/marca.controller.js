import prisma from '../lib/prisma.js';

// =============================================
// 🏷️ CRUD MARCAS
// =============================================

/**
 * GET /api/v1/marcas
 * Listar todas las marcas con filtros opcionales
 * Query params:
 * - id_categoria: Filtrar por categoría
 * - nombre: Búsqueda por nombre (parcial)
 * - estado: ACT (default), INA, ALL
 * - incluirInactivas: true/false
 * - orderBy: nombre (asc/desc), productos (asc/desc)
 * - page: número de página (paginación)
 * - limit: items por página
 */
export const listarMarcas = async (req, res, next) => {
  try {
    const { 
      id_categoria, 
      nombre, 
      estado = 'ACT',
      incluirInactivas = 'false',
      orderBy = 'nombre',
      order = 'asc',
      page,
      limit
    } = req.query;

    console.log('🏷️ /marcas - Filtros recibidos:', { id_categoria, nombre, estado, incluirInactivas, orderBy, order, page, limit });

    // Construir filtros dinámicos
    const where = {};
    
    // Filtro por estado
    if (incluirInactivas === 'false' && estado !== 'ALL') {
      where.estado = estado;
    } else if (estado === 'ALL') {
      // No aplicar filtro de estado
    } else {
      where.estado = estado;
    }

    // Filtro por categoría
    if (id_categoria) {
      where.id_categoria = parseInt(id_categoria);
    }

    // Filtro por nombre (búsqueda parcial)
    if (nombre) {
      where.nombre = {
        contains: nombre,
        mode: 'insensitive'
      };
    }

    // Configurar ordenamiento
    let orderByClause;
    if (orderBy === 'productos') {
      orderByClause = { producto: { _count: order } };
    } else {
      orderByClause = { [orderBy]: order };
    }

    // Configurar paginación si se solicita
    const options = {
      where,
      orderBy: orderByClause,
      include: {
        categoria_producto: {
          select: {
            id_prod_categoria: true,
            nombre: true,
            descripcion: true,
            activo: true
          }
        },
        _count: {
          select: { producto: true }
        }
      }
    };

    // Aplicar paginación si se especifica
    if (page && limit) {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      options.skip = skip;
      options.take = parseInt(limit);
    }

    // Ejecutar consulta
    const marcas = await prisma.marca.findMany(options);

    // Contar total de marcas para paginación
    const totalMarcas = await prisma.marca.count({ where });

    // Formatear respuesta
    const marcasFormateadas = marcas.map(marca => ({
      ...marca,
      cantidad_productos: marca._count.producto,
      categoria: marca.categoria_producto,
      activo: marca.estado === 'ACT'
    }));

    const response = {
      status: 'success',
      message: 'Marcas obtenidas exitosamente',
      data: marcasFormateadas,
      total: totalMarcas
    };

    // Agregar metadata de paginación si aplica
    if (page && limit) {
      response.pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalMarcas,
        totalPages: Math.ceil(totalMarcas / parseInt(limit)),
        hasNextPage: parseInt(page) * parseInt(limit) < totalMarcas,
        hasPrevPage: parseInt(page) > 1
      };
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/marcas/:id
 * Obtener una marca por ID con información detallada
 */
export const obtenerMarca = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { incluirProductos = 'false' } = req.query;

    const includeOptions = {
      categoria_producto: {
        select: {
          id_prod_categoria: true,
          nombre: true,
          descripcion: true,
          activo: true
        }
      },
      _count: {
        select: { producto: true }
      }
    };

    // Si se solicita, incluir los productos de la marca
    if (incluirProductos === 'true') {
      includeOptions.producto = {
        where: { estado: 'ACT' },
        select: {
          id_producto: true,
          descripcion: true,
          precio_venta: true,
          saldo_actual: true,
          imagen_url: true,
          estado: true
        },
        take: 20, // Limitar a 20 productos
        orderBy: { descripcion: 'asc' }
      };
    }

    const marca = await prisma.marca.findUnique({
      where: { id_marca: parseInt(id) },
      include: includeOptions
    });

    if (!marca) {
      return res.status(404).json({
        status: 'error',
        message: 'Marca no encontrada'
      });
    }

    // Formatear respuesta
    const marcaFormateada = {
      ...marca,
      cantidad_productos: marca._count.producto,
      categoria: marca.categoria_producto,
      activo: marca.estado === 'ACT'
    };

    res.json({
      status: 'success',
      message: 'Marca obtenida exitosamente',
      data: marcaFormateada
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/marcas
 * Crear una nueva marca
 * Body: { nombre: string, id_categoria: number, imagen_url?: string }
 */
export const crearMarca = async (req, res, next) => {
  try {
    const { nombre, id_categoria, imagen_url } = req.body;

    // Validaciones
    if (!nombre || !id_categoria) {
      return res.status(400).json({
        status: 'error',
        message: 'nombre e id_categoria son requeridos'
      });
    }

    // Verificar que la categoría existe
    const categoria = await prisma.categoria_producto.findUnique({
      where: { id_prod_categoria: parseInt(id_categoria) }
    });

    if (!categoria) {
      return res.status(404).json({
        status: 'error',
        message: 'Categoría no encontrada'
      });
    }

    // Verificar que no exista una marca con el mismo nombre
    const marcaExistente = await prisma.marca.findFirst({
      where: { 
        nombre: {
          equals: nombre,
          mode: 'insensitive'
        }
      }
    });

    if (marcaExistente) {
      return res.status(400).json({
        status: 'error',
        message: 'Ya existe una marca con ese nombre'
      });
    }
    if (marcaExistente) {
      return res.status(400).json({
        status: 'error',
        message: 'Ya existe una marca con ese nombre'
      });
    }

    // Crear la marca
    const marca = await prisma.marca.create({
      data: {
        nombre,
        id_categoria: parseInt(id_categoria),
        imagen_url: imagen_url || null,
        estado: 'ACT'
      },
      include: {
        categoria_producto: {
          select: {
            id_prod_categoria: true,
            nombre: true,
            descripcion: true
          }
        },
        _count: {
          select: { producto: true }
        }
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Marca creada exitosamente',
      data: {
        ...marca,
        cantidad_productos: marca._count.producto,
        categoria: marca.categoria_producto,
        activo: true
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/marcas/:id
 * Actualizar una marca
 * Body: { nombre?: string, id_categoria?: number, imagen_url?: string, estado?: string }
 */
export const actualizarMarca = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, id_categoria, imagen_url, estado } = req.body;

    // Verificar que la marca existe
    const marcaExistente = await prisma.marca.findUnique({
      where: { id_marca: parseInt(id) }
    });

    if (!marcaExistente) {
      return res.status(404).json({
        status: 'error',
        message: 'Marca no encontrada'
      });
    }

    // Construir objeto de actualización
    const data = {};
    
    if (nombre !== undefined) {
      // Verificar que no exista otra marca con el mismo nombre
      const otraMarca = await prisma.marca.findFirst({
        where: { 
          nombre: {
            equals: nombre,
            mode: 'insensitive'
          },
          NOT: { id_marca: parseInt(id) }
        }
      });

      if (otraMarca) {
        return res.status(400).json({
          status: 'error',
          message: 'Ya existe otra marca con ese nombre'
        });
      }
      data.nombre = nombre;
    }
    
    if (id_categoria !== undefined) {
      // Verificar que la categoría existe
      const categoria = await prisma.categoria_producto.findUnique({
        where: { id_prod_categoria: parseInt(id_categoria) }
      });

      if (!categoria) {
        return res.status(404).json({
          status: 'error',
          message: 'Categoría no encontrada'
        });
      }
      data.id_categoria = parseInt(id_categoria);
    }
    
    if (imagen_url !== undefined) {
      data.imagen_url = imagen_url;
    }
    
    if (estado !== undefined) {
      if (!['ACT', 'INA'].includes(estado)) {
        return res.status(400).json({
          status: 'error',
          message: 'Estado debe ser ACT o INA'
        });
      }
      data.estado = estado;
    }

    // Actualizar la marca
    const marca = await prisma.marca.update({
      where: { id_marca: parseInt(id) },
      data,
      include: {
        categoria_producto: {
          select: {
            id_prod_categoria: true,
            nombre: true,
            descripcion: true
          }
        },
        _count: {
          select: { producto: true }
        }
      }
    });

    res.json({
      status: 'success',
      message: 'Marca actualizada exitosamente',
      data: {
        ...marca,
        cantidad_productos: marca._count.producto,
        categoria: marca.categoria_producto,
        activo: marca.estado === 'ACT'
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/marcas/:id
 * Eliminar una marca (soft delete)
 */
export const eliminarMarca = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar que la marca existe
    const marcaExistente = await prisma.marca.findUnique({
      where: { id_marca: parseInt(id) },
      include: {
        _count: {
          select: { producto: true }
        }
      }
    });

    if (!marcaExistente) {
      return res.status(404).json({
        status: 'error',
        message: 'Marca no encontrada'
      });
    }

    // Advertir si tiene productos asociados
    if (marcaExistente._count.producto > 0) {
      const marca = await prisma.marca.update({
        where: { id_marca: parseInt(id) },
        data: { estado: 'INA' },
        include: {
          categoria_producto: {
            select: {
              id_prod_categoria: true,
              nombre: true
            }
          }
        }
      });

      return res.json({
        status: 'success',
        message: `Marca desactivada. Tiene ${marcaExistente._count.producto} producto(s) asociado(s)`,
        data: {
          ...marca,
          cantidad_productos: marcaExistente._count.producto,
          activo: false
        },
        warning: 'La marca tiene productos asociados y fue desactivada en lugar de eliminada'
      });
    }

    // Si no tiene productos, hacer soft delete
    const marca = await prisma.marca.update({
      where: { id_marca: parseInt(id) },
      data: { estado: 'INA' }
    });

    res.json({
      status: 'success',
      message: 'Marca desactivada exitosamente',
      data: marca
    });
  } catch (err) {
    next(err);
  }
};

export default {
  listarMarcas,
  obtenerMarca,
  crearMarca,
  actualizarMarca,
  eliminarMarca
};
