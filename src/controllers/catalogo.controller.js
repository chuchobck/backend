import prisma from '../lib/prisma.js';

// ========== CATEGORÍAS ==========
export const listarCategorias = async (req, res, next) => {
  try {
    const categorias = await prisma.categoria_producto.findMany({
      where: { activo: true },
      select: {
        id_categoria_producto: true,
        nombre: true,
        activo: true
      }
    });

    res.json({ success: true, data: categorias });
  } catch (error) {
    next(error);
  }
};

export const obtenerCategoria = async (req, res, next) => {
  try {
    const categoria = await prisma.categoria_producto.findUnique({
      where: { id_categoria_producto: parseInt(req.params.id) }
    });

    if (!categoria) {
      return res.status(404).json({ success: false });
    }

    res.json({ success: true, data: categoria });
  } catch (error) {
    next(error);
  }
};

// ========== MARCAS ==========
export const listarMarcas = async (req, res, next) => {
  try {
    const marcas = await prisma.marca.findMany({
      where: { estado: 'ACT' },
      orderBy: { nombre: 'asc' }
    });

    res.json({ success: true, data: marcas });
  } catch (error) {
    next(error);
  }
};

// ========== PRODUCTOS ==========
export const listarProductos = async (req, res, next) => {
  try {
    const {
      categoria,
      marcaId,
      busqueda,
      precioMin,
      precioMax,
      volumen,
      origen,
      soloDisponibles,
      ordenarPor,
      pagina = 1,
      limite = 30
    } = req.query;

    // Construir condiciones WHERE dinámicamente
    const where = {
      estado: 'ACT'
    };

    // Filtro por categoría
    if (categoria) {
      where.id_categoria_producto = parseInt(categoria);
    }

    // Filtro por marca
    if (marcaId) {
      where.id_marca = parseInt(marcaId);
    }

    // Búsqueda por nombre/descripción
    if (busqueda) {
      where.descripcion = {
        contains: busqueda,
        mode: 'insensitive'
      };
    }

    // Filtro por rango de precios
    if (precioMin || precioMax) {
      where.precio_venta = {};
      if (precioMin) where.precio_venta.gte = parseFloat(precioMin);
      if (precioMax) where.precio_venta.lte = parseFloat(precioMax);
    }

    // Filtro por volumen
    if (volumen) {
      where.volumen = parseFloat(volumen);
    }

    // Filtro por origen
    if (origen) {
      where.origen = origen;
    }

    // Solo productos con stock
    if (soloDisponibles === 'true') {
      where.saldo_actual = { gt: 0 };
    }

    // Configurar ordenamiento
    let orderBy = { id_producto: 'desc' }; // Por defecto: más recientes por ID
    
    if (ordenarPor === 'precio_asc') {
      orderBy = { precio_venta: 'asc' };
    } else if (ordenarPor === 'precio_desc') {
      orderBy = { precio_venta: 'desc' };
    } else if (ordenarPor === 'nombre' || ordenarPor === 'nombre_asc') {
      orderBy = { descripcion: 'asc' };
    } else if (ordenarPor === 'popular') {
      // Para "popular" ordenar por stock (más vendidos = menos stock restante)
      orderBy = { saldo_actual: 'desc' };
    }

    // Paginación
    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    const take = parseInt(limite);

    // Consultar productos con filtros
    const productos = await prisma.producto.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        categoria_producto: {
          select: {
            id_categoria_producto: true,
            nombre: true
          }
        },
        marca: {
          select: {
            id_marca: true,
            nombre: true,
            logo_url: true
          }
        },
        unidad_medida_producto_id_um_ventaTounidad_medida: {
          select: {
            id_unidad_medida: true,
            descripcion: true
          }
        }
      }
    });

    // Transformar datos para el frontend
    const productosTransformados = productos.map(p => ({
      id_producto: p.id_producto,
      nombre: p.descripcion,
      descripcion: p.descripcion,
      precio_venta: parseFloat(p.precio_venta),
      precio_regular: p.precio_regular ? parseFloat(p.precio_regular) : parseFloat(p.precio_venta),
      volumen: p.volumen,
      volumen_ml: p.volumen,
      alcohol_vol: p.porcentaje_alcohol,
      porcentaje_alcohol: p.porcentaje_alcohol,
      origen: p.origen,
      notas_cata: p.notas_cata,
      stock: p.saldo_actual,
      saldo_actual: p.saldo_actual,
      estado: p.estado,
      activo: p.estado === 'ACT',
      imagen_url: p.imagen_url,
      categoria: p.categoria_producto ? {
        id_categoria: p.categoria_producto.id_categoria_producto,
        nombre: p.categoria_producto.nombre
      } : null,
      marca: p.marca ? {
        id_marca: p.marca.id_marca,
        nombre: p.marca.nombre,
        logo_url: p.marca.logo_url
      } : null,
      unidad_medida: p.unidad_medida_producto_id_um_ventaTounidad_medida ? {
        id_unidad_medida: p.unidad_medida_producto_id_um_ventaTounidad_medida.id_unidad_medida,
        nombre: p.unidad_medida_producto_id_um_ventaTounidad_medida.descripcion
      } : null
    }));

    res.json({ 
      status: 'success',
      data: productosTransformados 
    });
  } catch (error) {
    console.error('❌ Error en listarProductos:', error);
    next(error);
  }
};

export const obtenerProducto = async (req, res, next) => {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id_producto: req.params.id },
      include: {
        categoria_producto: {
          select: {
            id_categoria_producto: true,
            nombre: true
          }
        },
        marca: {
          select: {
            id_marca: true,
            nombre: true,
            logo_url: true
          }
        },
        unidad_medida_producto_id_um_ventaTounidad_medida: {
          select: {
            id_unidad_medida: true,
            descripcion: true
          }
        }
      }
    });

    if (!producto) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Producto no encontrado' 
      });
    }

    // Transformar datos
    const productoTransformado = {
      id_producto: producto.id_producto,
      nombre: producto.descripcion,
      descripcion: producto.descripcion,
      precio_venta: parseFloat(producto.precio_venta),
      precio_regular: producto.precio_regular ? parseFloat(producto.precio_regular) : parseFloat(producto.precio_venta),
      volumen: producto.volumen,
      volumen_ml: producto.volumen,
      alcohol_vol: producto.porcentaje_alcohol,
      porcentaje_alcohol: producto.porcentaje_alcohol,
      origen: producto.origen,
      notas_cata: producto.notas_cata,
      stock: producto.saldo_actual,
      saldo_actual: producto.saldo_actual,
      estado: producto.estado,
      activo: producto.estado === 'ACT',
      imagen_url: producto.imagen_url,
      categoria: producto.categoria_producto ? {
        id_categoria: producto.categoria_producto.id_categoria_producto,
        nombre: producto.categoria_producto.nombre
      } : null,
      marca: producto.marca ? {
        id_marca: producto.marca.id_marca,
        nombre: producto.marca.nombre,
        logo_url: producto.marca.logo_url
      } : null,
      unidad_medida: producto.unidad_medida_producto_id_um_ventaTounidad_medida ? {
        id_unidad_medida: producto.unidad_medida_producto_id_um_ventaTounidad_medida.id_unidad_medida,
        nombre: producto.unidad_medida_producto_id_um_ventaTounidad_medida.descripcion
      } : null
    };

    res.json({ 
      status: 'success', 
      data: productoTransformado 
    });
  } catch (error) {
    console.error('❌ Error en obtenerProducto:', error);
    next(error);
  }
};

// ========== FILTROS ==========
export const obtenerFiltros = async (req, res, next) => {
  try {
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// ========== DESTACADOS ==========
export const listarDestacados = async (req, res, next) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
};

export const listarNuevos = async (req, res, next) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
};
