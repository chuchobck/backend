// src/controllers/categoria-promocion.controller.js
import prisma from '../lib/prisma.js';

/**
 * GET /api/v1/categorias-promocion
 * Listar todas las categorías de promoción
 * Query params: activo (true/false/all)
 */
export const listarCategoriasPromocion = async (req, res, next) => {
  try {
    const { activo } = req.query;
    
    const whereClause = {};
    
    // Filtro por activo
    if (activo && activo !== 'all') {
      whereClause.activo = String(activo).toLowerCase() === 'true';
    }

    const categorias = await prisma.categoria_promocion.findMany({
      where: whereClause,
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { promocion: true }
        }
      }
    });

    if (categorias.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No existen categorías de promoción registradas',
        data: []
      });
    }

    res.json({
      status: 'success',
      message: 'Categorías de promoción obtenidas correctamente',
      data: categorias.map(cat => ({
        ...cat,
        cantidad_promociones: cat._count.promocion
      }))
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/categorias-promocion/buscar
 * Búsqueda flexible de categorías de promoción
 * Query params: nombre, activo
 */
export const buscarCategoriasPromocion = async (req, res, next) => {
  try {
    const { nombre, activo } = req.query;

    if (!nombre && typeof activo === 'undefined') {
      return res.status(400).json({
        status: 'error',
        message: 'Ingrese al menos un criterio de búsqueda',
        data: null
      });
    }

    const whereClause = {};

    if (nombre) {
      whereClause.nombre = {
        contains: nombre,
        mode: 'insensitive'
      };
    }

    if (typeof activo !== 'undefined') {
      whereClause.activo = String(activo).toLowerCase() === 'true';
    }

    const categorias = await prisma.categoria_promocion.findMany({
      where: whereClause,
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { promocion: true }
        }
      }
    });

    if (categorias.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron categorías',
        data: []
      });
    }

    res.json({
      status: 'success',
      message: 'Búsqueda completada',
      data: categorias,
      total_resultados: categorias.length
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/categorias-promocion/:id
 * Obtener una categoría de promoción por ID
 */
export const obtenerCategoriaPromocion = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de categoría de promoción inválido',
        data: null
      });
    }

    const categoria = await prisma.categoria_promocion.findUnique({
      where: { id_prom_categoria: id },
      include: {
        _count: {
          select: { promocion: true }
        }
      }
    });

    if (!categoria) {
      return res.status(404).json({
        status: 'error',
        message: 'Categoría de promoción no encontrada',
        data: null
      });
    }

    res.json({
      status: 'success',
      message: 'Categoría de promoción obtenida correctamente',
      data: {
        ...categoria,
        cantidad_promociones: categoria._count.promocion
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/categorias-promocion
 * Crear una nueva categoría de promoción
 */
export const crearCategoriaPromocion = async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body;

    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Nombre de la categoría es requerido',
        data: null
      });
    }

    // Verificar duplicados
    const existente = await prisma.categoria_promocion.findFirst({
      where: {
        nombre: {
          equals: nombre.trim(),
          mode: 'insensitive'
        }
      }
    });

    if (existente) {
      return res.status(400).json({
        status: 'error',
        message: 'Ya existe una categoría con ese nombre',
        data: null
      });
    }

    const nuevaCategoria = await prisma.categoria_promocion.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion ? descripcion.trim() : null,
        activo: true
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Categoría de promoción creada correctamente',
      data: nuevaCategoria
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/categorias-promocion/:id
 * Actualizar una categoría de promoción
 */
export const actualizarCategoriaPromocion = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { nombre, descripcion, activo } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de categoría de promoción inválido',
        data: null
      });
    }

    const categoria = await prisma.categoria_promocion.findUnique({
      where: { id_prom_categoria: id }
    });

    if (!categoria) {
      return res.status(404).json({
        status: 'error',
        message: 'Categoría de promoción no encontrada',
        data: null
      });
    }

    // Construir data de actualización
    const data = {};
    
    if (nombre !== undefined) {
      if (nombre.trim() === '') {
        return res.status(400).json({
          status: 'error',
          message: 'Nombre de la categoría no puede estar vacío',
          data: null
        });
      }
      
      // Verificar duplicados
      const existente = await prisma.categoria_promocion.findFirst({
        where: {
          nombre: {
            equals: nombre.trim(),
            mode: 'insensitive'
          },
          NOT: { id_prom_categoria: id }
        }
      });

      if (existente) {
        return res.status(400).json({
          status: 'error',
          message: 'Ya existe otra categoría con ese nombre',
          data: null
        });
      }
      
      data.nombre = nombre.trim();
    }
    
    if (descripcion !== undefined) {
      data.descripcion = descripcion ? descripcion.trim() : null;
    }
    
    if (activo !== undefined) {
      data.activo = Boolean(activo);
    }

    const categoriaActualizada = await prisma.categoria_promocion.update({
      where: { id_prom_categoria: id },
      data
    });

    res.json({
      status: 'success',
      message: 'Categoría de promoción actualizada correctamente',
      data: categoriaActualizada
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/categorias-promocion/:id
 * Eliminar (desactivar) una categoría de promoción
 */
export const eliminarCategoriaPromocion = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de categoría de promoción inválido',
        data: null
      });
    }

    const categoria = await prisma.categoria_promocion.findUnique({
      where: { id_prom_categoria: id },
      include: {
        _count: {
          select: { promocion: true }
        }
      }
    });

    if (!categoria) {
      return res.status(404).json({
        status: 'error',
        message: 'Categoría de promoción no encontrada',
        data: null
      });
    }

    if (!categoria.activo) {
      return res.status(400).json({
        status: 'error',
        message: 'La categoría de promoción ya se encuentra desactivada',
        data: null
      });
    }

    const categoriaDesactivada = await prisma.categoria_promocion.update({
      where: { id_prom_categoria: id },
      data: { activo: false }
    });

    res.json({
      status: 'success',
      message: 'Categoría de promoción desactivada correctamente',
      data: categoriaDesactivada,
      warning: categoria._count.promocion > 0 
        ? `Esta categoría tiene ${categoria._count.promocion} promoción(es) asociada(s)`
        : null
    });
  } catch (err) {
    next(err);
  }
};

export default {
  listarCategoriasPromocion,
  buscarCategoriasPromocion,
  obtenerCategoriaPromocion,
  crearCategoriaPromocion,
  actualizarCategoriaPromocion,
  eliminarCategoriaPromocion
};
