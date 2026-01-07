// src/routes/catalogo.routes.js - Rutas para el catálogo (E-commerce)
// Este archivo maneja todas las peticiones del frontend de e-commerce

import { Router } from 'express';
import {
  listarProductos,
  buscarProductos
} from '../controllers/productos.controller.js';
import prisma from '../config/database.js';

const router = Router();

// ========== CATEGORÍAS ==========

// GET /api/v1/catalogo/categorias - Listar todas las categorías
router.get('/categorias', async (req, res) => {
  try {
    const categorias = await prisma.categoria_producto.findMany({
      where: { activo: true },
      select: {
        id_categoria_producto: true,
        nombre: true,
        activo: true
      }
    });

    res.json({
      success: true,
      data: categorias
    });
  } catch (error) {
    console.error('Error cargando categorías:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cargar categorías',
      details: error.message
    });
  }
});

// GET /api/v1/catalogo/categorias/:id - Obtener una categoría
router.get('/categorias/:id', async (req, res) => {
  try {
    const categoria = await prisma.categoria_producto.findUnique({
      where: { id_categoria_producto: parseInt(req.params.id) },
      select: {
        id_categoria_producto: true,
        nombre: true,
        activo: true
      }
    });

    if (!categoria) {
      return res.status(404).json({
        success: false,
        error: 'Categoría no encontrada'
      });
    }

    res.json({
      success: true,
      data: categoria
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al cargar categoría',
      details: error.message
    });
  }
});

// ========== MARCAS ==========

// GET /api/v1/catalogo/marcas - Listar marcas (con filtro opcional por categoría)
router.get('/marcas', async (req, res) => {
  try {
    const { categoria } = req.query;

    const where = { estado: 'ACT' };
    if (categoria) {
      if (!isNaN(parseInt(categoria))) {
        where.id_categoria_producto = parseInt(categoria);
      } else {
        where.categoria_producto = { nombre: { equals: categoria, mode: 'insensitive' } };
      }
    }

    const marcas = await prisma.marca.findMany({
      where,
      select: {
        id_marca: true,
        nombre: true,
        logo_url: true,
        id_categoria: true,
        estado: true
      },
      orderBy: { nombre: 'asc' }
    });

    res.json({
      success: true,
      data: marcas
    });
  } catch (error) {
    console.error('Error cargando marcas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cargar marcas',
      details: error.message
    });
  }
});

// ========== PRODUCTOS ==========

// GET /api/v1/catalogo/productos - Listar productos con filtros
router.get('/productos', async (req, res) => {
  try {
    const {
      categoria,
      marcaId,
      busqueda,
      precioMin,
      precioMax,
      volumen,
      origen,
      ordenarPor = 'nombre_asc',
      pagina = 1,
      limite = 12,
      soloDisponibles = false
    } = req.query;

    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    const take = parseInt(limite);

    // Construir where
    const where = {
      estado: 'ACT'
    };

    if (categoria) {
      if (!isNaN(parseInt(categoria))) {
        where.id_categoria_producto = parseInt(categoria);
      } else {
        where.categoria_producto = { nombre: { equals: categoria, mode: 'insensitive' } };
      }
    }

    if (marcaId && !isNaN(parseInt(marcaId))) {
      where.id_marca = parseInt(marcaId);
    }

    if (busqueda) {
      where.OR = [
        { descripcion: { contains: busqueda, mode: 'insensitive' } },
        { marca: { nombre: { contains: busqueda, mode: 'insensitive' } } }
      ];
    }

    if (precioMin || precioMax) {
      where.precio_venta = {};
      if (precioMin) where.precio_venta.gte = parseFloat(precioMin);
      if (precioMax) where.precio_venta.lte = parseFloat(precioMax);
    }

    if (volumen) {
      where.volumen = parseFloat(volumen);
    }

    if (origen) {
      where.origen = origen;
    }

    if (soloDisponibles === 'true' || soloDisponibles === true) {
      where.saldo_actual = { gt: 0 };
    }

    // Ordenamiento
    let orderBy = { descripcion: 'asc' };
    switch (ordenarPor) {
      case 'nombre_desc':
        orderBy = { descripcion: 'desc' };
        break;
      case 'precio_asc':
        orderBy = { precio_venta: 'asc' };
        break;
      case 'precio_desc':
        orderBy = { precio_venta: 'desc' };
        break;
      case 'popular':
        orderBy = { saldo_actual: 'desc' };
        break;
      default:
        orderBy = { descripcion: 'asc' };
    }

    // Contar total
    const total = await prisma.producto.count({ where });

    // Obtener productos
    const productos = await prisma.producto.findMany({
      where,
      select: {
        id_producto: true,
        descripcion: true,
        precio_venta: true,
        precio_regular: true,
        volumen: true,
        alcohol_vol: true,
        origen: true,
        notas_cata: true,
        saldo_actual: true,
        estado: true,
        imagen_url: true,
        marca: {
          select: {
            id_marca: true,
            nombre: true,
            id_categoria: true,
            estado: true
          }
        },
        categoria_producto: {
          select: {
            id_categoria_producto: true,
            nombre: true
          }
        }
      },
      orderBy,
      skip,
      take
    });

    const totalPaginas = Math.ceil(total / parseInt(limite));

    res.json({
      success: true,
      data: {
        productos,
        total,
        pagina: parseInt(pagina),
        totalPaginas,
        limite: parseInt(limite)
      }
    });
  } catch (error) {
    console.error('Error cargando productos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cargar productos',
      details: error.message
    });
  }
});

// GET /api/v1/catalogo/productos/:id - Obtener un producto
router.get('/productos/:id', async (req, res) => {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id_producto: parseInt(req.params.id) },
      select: {
        id_producto: true,
        descripcion: true,
        precio_venta: true,
        precio_regular: true,
        volumen: true,
        alcohol_vol: true,
        origen: true,
        notas_cata: true,
        saldo_actual: true,
        estado: true,
        imagen_url: true,
        marca: {
          select: {
            id_marca: true,
            nombre: true,
            id_categoria: true,
            estado: true
          }
        },
        categoria_producto: {
          select: {
            id_categoria_producto: true,
            nombre: true
          }
        }
      }
    });

    if (!producto) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    res.json({
      success: true,
      data: producto
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al cargar producto',
      details: error.message
    });
  }
});

// ========== FILTROS DINÁMICOS ==========

// GET /api/v1/catalogo/filtros - Obtener valores dinámicos para filtros
router.get('/filtros', async (req, res) => {
  try {
    const { categoria, marcaId } = req.query;

    const where = { estado: 'ACT' };
    if (categoria) {
      if (!isNaN(parseInt(categoria))) {
        where.id_categoria_producto = parseInt(categoria);
      } else {
        where.categoria_producto = { nombre: { equals: categoria, mode: 'insensitive' } };
      }
    }
    if (marcaId && !isNaN(parseInt(marcaId))) {
      where.id_marca = parseInt(marcaId);
    }

    // Obtener valores únicos
    const [origenes, volumenes] = await Promise.all([
      prisma.producto.findMany({
        where,
        select: { origen: true },
        distinct: ['origen']
      }),
      prisma.producto.findMany({
        where,
        select: { volumen: true },
        distinct: ['volumen']
      })
    ]);

    // Obtener rango de precios y alcohol
    const precioAlcohol = await prisma.producto.aggregate({
      where,
      _min: { precio_venta: true, alcohol_vol: true },
      _max: { precio_venta: true, alcohol_vol: true }
    });

    res.json({
      success: true,
      data: {
        origenes: origenes.filter(o => o.origen).map(o => o.origen),
        volumenes: volumenes.filter(v => v.volumen).map(v => v.volumen).sort((a, b) => a - b),
        precioRango: {
          min: precioAlcohol._min.precio_venta || 0,
          max: precioAlcohol._max.precio_venta || 1000
        },
        alcoholRango: {
          min: precioAlcohol._min.alcohol_vol || 0,
          max: precioAlcohol._max.alcohol_vol || 50
        }
      }
    });
  } catch (error) {
    console.error('Error cargando filtros:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cargar filtros',
      details: error.message
    });
  }
});

// ========== PRODUCTOS DESTACADOS Y NUEVOS ==========

// GET /api/v1/catalogo/productos/destacados - Productos destacados
router.get('/destacados', async (req, res) => {
  try {
    const { limite = 8 } = req.query;

    const productos = await prisma.producto.findMany({
      where: {
        estado: 'ACT',
        saldo_actual: { gt: 0 }
      },
      select: {
        id_producto: true,
        descripcion: true,
        precio_venta: true,
        precio_regular: true,
        volumen: true,
        alcohol_vol: true,
        origen: true,
        saldo_actual: true,
        imagen_url: true,
        marca: {
          select: {
            id_marca: true,
            nombre: true
          }
        }
      },
      orderBy: { saldo_actual: 'desc' },
      take: parseInt(limite)
    });

    res.json({
      success: true,
      data: productos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al cargar destacados',
      details: error.message
    });
  }
});

// GET /api/v1/catalogo/productos/nuevos - Productos nuevos
router.get('/nuevos', async (req, res) => {
  try {
    const { limite = 8 } = req.query;

    const productos = await prisma.producto.findMany({
      where: {
        estado: 'ACT',
        saldo_actual: { gt: 0 }
      },
      select: {
        id_producto: true,
        descripcion: true,
        precio_venta: true,
        precio_regular: true,
        volumen: true,
        alcohol_vol: true,
        origen: true,
        saldo_actual: true,
        imagen_url: true,
        marca: {
          select: {
            id_marca: true,
            nombre: true
          }
        }
      },
      orderBy: { id_producto: 'desc' },
      take: parseInt(limite)
    });

    res.json({
      success: true,
      data: productos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al cargar nuevos',
      details: error.message
    });
  }
});

export default router;
