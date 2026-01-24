import prisma from '../lib/prisma.js';

/**
 * GET /api/v1/productos
 * F6.4.1 Consulta general
 */
export const listarProductos = async (req, res, next) => {
  try {
    const productos = await prisma.producto.findMany({
      where: { estado: 'ACT' },
      include: {
        categoria_producto: true,
        marca: true,
        unidad_medida_producto_id_um_compraTounidad_medida: true,
        unidad_medida_producto_id_um_ventaTounidad_medida: true
      }
    });

    if (productos.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No existen productos registrados',
        data: []
      });
    }

    res.json({
      status: 'success',
      message: 'Productos obtenidos correctamente',
      data: productos
    });
  } catch (err) {
    next(err); // E1: Desconexión BD
  }
};

/**
 * GET /api/v1/productos/buscar
 * Búsqueda flexible de productos (para e-commerce y backoffice)
 * Query params: id, codigo_barras, descripcion, categoriaId, marcaId, 
 *               estado, precioMin, precioMax, volumen, origen, 
 *               soloDisponibles, ordenarPor, pagina, limite
 */
export const buscarProductos = async (req, res, next) => {
  try {
    const {
      id,
      codigo_barras,
      descripcion,
      categoriaId,
      marcaId,
      estado,
      precioMin,
      precioMax,
      volumen,
      origen,
      soloDisponibles,
      ordenarPor,
      pagina = 1,
      limite = 30
    } = req.query;

    // 🔷 Búsqueda por ID específico
    if (id) {
      const producto = await prisma.producto.findUnique({
        where: { id_producto: id },
        include: {
          categoria_producto: {
            select: {
              id_prod_categoria: true,
              nombre: true
            }
          },
          marca: {
            select: {
              id_marca: true,
              nombre: true,
              imagen_url: true
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
          message: 'Producto no encontrado',
          data: null
        });
      }

      return res.json({
        status: 'success',
        message: 'Producto encontrado',
        data: producto
      });
    }

    // 🔷 Búsqueda por código de barras
    if (codigo_barras) {
      const producto = await prisma.producto.findUnique({
        where: { codigo_barras },
        include: {
          categoria_producto: true,
          marca: true,
          unidad_medida_producto_id_um_ventaTounidad_medida: true
        }
      });

      if (!producto) {
        return res.status(404).json({
          status: 'error',
          message: 'Producto no encontrado',
          data: null
        });
      }

      return res.json({
        status: 'success',
        message: 'Producto encontrado',
        data: producto
      });
    }

    // 🔷 CONSTRUIR FILTROS DINÁMICAMENTE
    const whereClause = {};

    // Estado (por defecto solo activos)
    if (estado) {
      whereClause.estado = estado;
    } else {
      whereClause.estado = 'ACT'; // Por defecto solo activos
    }

    // Búsqueda por descripción
    if (descripcion) {
      whereClause.descripcion = {
        contains: descripcion,
        mode: 'insensitive'
      };
    }

    // Filtro por categoría
    if (categoriaId) {
      whereClause.id_prod_categoria = parseInt(categoriaId);
    }

    // Filtro por marca
    if (marcaId) {
      whereClause.id_marca = parseInt(marcaId);
    }

    // Filtro por rango de precios
    if (precioMin || precioMax) {
      whereClause.precio_venta = {};
      if (precioMin) whereClause.precio_venta.gte = parseFloat(precioMin);
      if (precioMax) whereClause.precio_venta.lte = parseFloat(precioMax);
    }

    // Filtro por volumen
    if (volumen) {
      whereClause.volumen = parseFloat(volumen);
    }

    // Filtro por origen
    if (origen) {
      whereClause.origen = {
        contains: origen,
        mode: 'insensitive'
      };
    }

    // Solo productos con stock disponible
    if (soloDisponibles === 'true') {
      whereClause.saldo_actual = { gt: 0 };
    }

    // 🔷 CONFIGURAR ORDENAMIENTO
    let orderBy = { id_producto: 'desc' }; // Por defecto: más recientes

    if (ordenarPor === 'precio_asc') {
      orderBy = { precio_venta: 'asc' };
    } else if (ordenarPor === 'precio_desc') {
      orderBy = { precio_venta: 'desc' };
    } else if (ordenarPor === 'nombre' || ordenarPor === 'nombre_asc') {
      orderBy = { descripcion: 'asc' };
    } else if (ordenarPor === 'popular') {
      // Más vendidos = menos stock restante (aproximación)
      orderBy = { saldo_actual: 'asc' };
    }

    // 🔷 PAGINACIÓN
    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    const take = parseInt(limite);

    // Contar total
    const totalProductos = await prisma.producto.count({ where: whereClause });

    // Ejecutar búsqueda
    const productos = await prisma.producto.findMany({
      where: whereClause,
      orderBy,
      skip,
      take,
      include: {
        categoria_producto: {
          select: {
            id_prod_categoria: true,
            nombre: true
          }
        },
        marca: {
          select: {
            id_marca: true,
            nombre: true,
            imagen_url: true
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

    if (productos.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron productos con los criterios especificados',
        data: [],
        pagination: {
          pagina: parseInt(pagina),
          limite: parseInt(limite),
          total: 0,
          totalPaginas: 0
        }
      });
    }

    return res.json({
      status: 'success',
      message: 'Búsqueda completada',
      data: productos,
      total_resultados: totalProductos,
      pagination: {
        pagina: parseInt(pagina),
        limite: parseInt(limite),
        total: totalProductos,
        totalPaginas: Math.ceil(totalProductos / parseInt(limite))
      },
      criterios_aplicados: {
        descripcion: descripcion || null,
        categoriaId: categoriaId || null,
        marcaId: marcaId || null,
        estado: estado || 'ACT',
        precioMin: precioMin || null,
        precioMax: precioMax || null,
        volumen: volumen || null,
        origen: origen || null,
        soloDisponibles: soloDisponibles || null,
        ordenarPor: ordenarPor || 'reciente'
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/productos
 * F6.1 Ingreso de Producto
 * 
 * NOTA IMPORTANTE: id_producto es autogenerado por la BD (P000001, P000002, etc)
 * NO se debe enviar en el body
 * 
 * Body esperado:
 * {
 *   descripcion: string (requerido)
 *   precio_venta: number (requerido)
 *   id_um_compra: number (requerido)
 *   id_um_venta: number (requerido)
 *   id_categoria: number (opcional)
 *   id_marca: number (opcional)
 *   costo_promedio: number (opcional)
 *   saldo_inicial: number (opcional)
 *   volumen: number (opcional)
 *   alcohol_vol: number (opcional)
 *   origen: string (opcional)
 *   notas_cata: string (opcional)
 *   imagen_url: string (opcional)
 * }
 */
export const crearProducto = async (req, res, next) => {
  try {
    const {
      codigo_barras,
      descripcion,
      id_categoria,
      id_marca,
      id_um_compra,
      id_um_venta,
      precio_venta,
      costo_promedio,
      saldo_inicial,
      volumen,
      alcohol_vol,
      origen,
      notas_cata,
      imagen_url
    } = req.body;

    // E5 – Datos obligatorios
    if (!descripcion || !precio_venta || !id_um_compra || !id_um_venta) {
      return res.status(400).json({
        status: 'error',
        message: 'Complete todos los campos requeridos: descripcion, precio_venta, id_um_compra, id_um_venta',
        data: null
      });
    }

    // E6 – Precio inválido
    if (precio_venta <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'El precio debe ser un valor numérico positivo',
        data: null
      });
    }

    // E2 – Producto duplicado (por codigo_barras)
    if (codigo_barras) {
      const existeProducto = await prisma.producto.findUnique({
        where: { codigo_barras }
      });

      if (existeProducto) {
        return res.status(409).json({
          status: 'error',
          message: 'El código de barras del producto ya existe',
          data: null
        });
      }
    }

    // E3 – Categoría inexistente (si se proporciona)
    if (id_categoria) {
      const categoria = await prisma.categoria_producto.findUnique({
        where: { id_categoria }
      });
      if (!categoria) {
        return res.status(400).json({
          status: 'error',
          message: 'La categoría seleccionada no es válida',
          data: null
        });
      }
    }

    // Validar marca si se proporciona
    if (id_marca) {
      const marca = await prisma.marca.findUnique({
        where: { id_marca }
      });
      if (!marca) {
        return res.status(400).json({
          status: 'error',
          message: 'La marca seleccionada no es válida',
          data: null
        });
      }
    }

    // Validar unidad de medida de compra
    const umCompra = await prisma.unidad_medida.findUnique({
      where: { id_um: id_um_compra }
    });
    if (!umCompra) {
      return res.status(400).json({
        status: 'error',
        message: 'La unidad de medida de compra no es válida',
        data: null
      });
    }

    // Validar unidad de medida de venta
    const umVenta = await prisma.unidad_medida.findUnique({
      where: { id_um: id_um_venta }
    });
    if (!umVenta) {
      return res.status(400).json({
        status: 'error',
        message: 'La unidad de medida de venta no es válida',
        data: null
      });
    }

    // Crear producto (id_producto se genera automáticamente por la BD)
    const nuevoProducto = await prisma.producto.create({
      data: {
        codigo_barras: codigo_barras || null,
        descripcion,
        id_categoria: id_categoria || null,
        id_marca: id_marca || null,
        id_um_compra,
        id_um_venta,
        precio_venta,
        costo_promedio: costo_promedio || 0,
        saldo_inicial: saldo_inicial || 0,
        ingresos: 0,
        egresos: 0,
        ajustes: 0,
        saldo_actual: saldo_inicial || 0,
        volumen: volumen || null,
        alcohol_vol: alcohol_vol || null,
        origen: origen || null,
        notas_cata: notas_cata || null,
        imagen_url: imagen_url || null,
        estado: 'ACT'
      },
      include: {
        categoria_producto: true,
        marca: true,
        unidad_medida_producto_id_um_compraTounidad_medida: true,
        unidad_medida_producto_id_um_ventaTounidad_medida: true
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Producto creado correctamente',
      data: nuevoProducto
    });
  } catch (err) {
    next(err); // E1
  }
};

/**
 * PUT /api/v1/productos/:id
 * F6.2 Actualización de producto
 * Permite actualizar: descripcion, precio_venta, costo_promedio, categoría, marca, unidades de medida
 * NO permite actualizar campos de inventario (saldo_inicial, ingresos, egresos, ajustes, saldo_actual)
 */
export const actualizarProducto = async (req, res, next) => {
  try {
    const id_producto = req.params.id; // VARCHAR (P000001)
    const { 
      codigo_barras,
      descripcion, 
      precio_venta, 
      costo_promedio,
      id_categoria, 
      id_marca, 
      id_um_compra, 
      id_um_venta,
      volumen,
      alcohol_vol,
      origen,
      notas_cata,
      imagen_url
    } = req.body;

    // Validar que el producto existe
    const producto = await prisma.producto.findUnique({
      where: { id_producto }
    });

    if (!producto) {
      return res.status(404).json({
        status: 'error',
        message: 'El producto no existe',
        data: null
      });
    }

    // Construir objeto de datos a actualizar (solo campos permitidos)
    const dataActualizar = {};

    // E2 – Validar que el nuevo código de barras no esté duplicado
    if (codigo_barras !== undefined && codigo_barras !== producto.codigo_barras) {
      const existeCodigoBarras = await prisma.producto.findUnique({
        where: { codigo_barras }
      });

      if (existeCodigoBarras) {
        return res.status(409).json({
          status: 'error',
          message: 'El código de barras ya existe en otro producto',
          data: null
        });
      }
      dataActualizar.codigo_barras = codigo_barras;
    }

    if (descripcion !== undefined) {
      dataActualizar.descripcion = descripcion;
    }

    if (precio_venta !== undefined) {
      if (precio_venta <= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'El precio de venta debe ser un valor numérico positivo',
          data: null
        });
      }
      dataActualizar.precio_venta = precio_venta;
    }

    if (costo_promedio !== undefined) {
      if (costo_promedio < 0) {
        return res.status(400).json({
          status: 'error',
          message: 'El costo promedio no puede ser negativo',
          data: null
        });
      }
      dataActualizar.costo_promedio = costo_promedio;
    }

    if (id_categoria !== undefined) {
      // Validar que la nueva categoría existe
      const categoria = await prisma.categoria_producto.findUnique({
        where: { id_categoria }
      });

      if (!categoria) {
        return res.status(404).json({
          status: 'error',
          message: 'La categoría especificada no existe',
          data: null
        });
      }
      dataActualizar.id_categoria = id_categoria;
    }

    if (id_marca !== undefined) {
      if (id_marca !== null) {
        const marca = await prisma.marca.findUnique({
          where: { id_marca }
        });
        if (!marca) {
          return res.status(404).json({
            status: 'error',
            message: 'La marca especificada no existe',
            data: null
          });
        }
      }
      dataActualizar.id_marca = id_marca;
    }

    if (id_um_compra !== undefined) {
      const umCompra = await prisma.unidad_medida.findUnique({
        where: { id_um: id_um_compra }
      });
      if (!umCompra) {
        return res.status(404).json({
          status: 'error',
          message: 'La unidad de medida de compra no existe',
          data: null
        });
      }
      dataActualizar.id_um_compra = id_um_compra;
    }

    if (id_um_venta !== undefined) {
      const umVenta = await prisma.unidad_medida.findUnique({
        where: { id_um: id_um_venta }
      });
      if (!umVenta) {
        return res.status(404).json({
          status: 'error',
          message: 'La unidad de medida de venta no existe',
          data: null
        });
      }
      dataActualizar.id_um_venta = id_um_venta;
    }

    if (volumen !== undefined) {
      dataActualizar.volumen = volumen;
    }

    if (alcohol_vol !== undefined) {
      dataActualizar.alcohol_vol = alcohol_vol;
    }

    if (origen !== undefined) {
      dataActualizar.origen = origen;
    }

    if (notas_cata !== undefined) {
      dataActualizar.notas_cata = notas_cata;
    }

    if (imagen_url !== undefined) {
      dataActualizar.imagen_url = imagen_url;
    }

    // Actualizar el producto
    const productoActualizado = await prisma.producto.update({
      where: { id_producto },
      data: dataActualizar,
      include: {
        categoria_producto: true,
        marca: true,
        unidad_medida_producto_id_um_compraTounidad_medida: true,
        unidad_medida_producto_id_um_ventaTounidad_medida: true
      }
    });

    res.json({
      status: 'success',
      message: 'Producto actualizado correctamente',
      data: productoActualizado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/productos/:id/estado
 * Cambiar estado del producto (ACT o INA)
 */
export const cambiarEstadoProducto = async (req, res, next) => {
  try {
    const id_producto = req.params.id; // VARCHAR
    const { estado } = req.body;

    if (!estado || (estado !== 'ACT' && estado !== 'INA')) {
      return res.status(400).json({
        status: 'error',
        message: 'Estado debe ser ACT (activo) o INA (inactivo)',
        data: null
      });
    }

    const producto = await prisma.producto.findUnique({
      where: { id_producto }
    });

    if (!producto) {
      return res.status(404).json({
        status: 'error',
        message: 'El producto no existe',
        data: null
      });
    }

    if (producto.estado === estado) {
      return res.status(400).json({
        status: 'error',
        message: `El producto ya está ${estado === 'ACT' ? 'activo' : 'inactivo'}`,
        data: null
      });
    }

    const productoActualizado = await prisma.producto.update({
      where: { id_producto },
      data: { estado },
      include: {
        categoria_producto: true,
        marca: true,
        unidad_medida_producto_id_um_compraTounidad_medida: true,
        unidad_medida_producto_id_um_ventaTounidad_medida: true
      }
    });

    res.json({
      status: 'success',
      message: `Producto ${estado === 'ACT' ? 'activado' : 'inactivado'} correctamente`,
      data: productoActualizado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/productos/:id
 * F6.3 Eliminación lógica
 */
export const eliminarProducto = async (req, res, next) => {
  try {
    const id_producto = req.params.id; // VARCHAR

    const producto = await prisma.producto.findUnique({
      where: { id_producto }
    });

    if (!producto) {
      return res.status(404).json({
        status: 'error',
        message: 'El producto no existe',
        data: null
      });
    }

    if (producto.estado === 'INA') {
      return res.status(400).json({
        status: 'error',
        message: 'El producto ya se encuentra inactivo',
        data: null
      });
    }

    await prisma.producto.update({
      where: { id_producto },
      data: { estado: 'INA' }
    });

    res.json({
      status: 'success',
      message: 'Producto eliminado correctamente',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/productos/:id/ajustar-stock
 * Ajustar stock de un producto (ajuste manual)
 * Usado por: Admin, Bodega
 * 
 * Body: { cantidad: number, motivo: string, tipo: 'INC' | 'DEC' }
 */
export const ajustarStock = async (req, res, next) => {
  try {
    const id_producto = req.params.id; // VARCHAR
    const { cantidad, motivo, tipo } = req.body;

    if (!id_producto) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de producto es requerido',
        data: null
      });
    }

    if (!cantidad || !tipo) {
      return res.status(400).json({
        status: 'error',
        message: 'Cantidad y tipo son requeridos',
        data: null
      });
    }

    if (tipo !== 'INC' && tipo !== 'DEC') {
      return res.status(400).json({
        status: 'error',
        message: 'Tipo debe ser INC (incremento) o DEC (decremento)',
        data: null
      });
    }

    const producto = await prisma.producto.findUnique({
      where: { id_producto }
    });

    if (!producto) {
      return res.status(404).json({
        status: 'error',
        message: 'Producto no encontrado',
        data: null
      });
    }

    // Actualizar ajustes según el tipo
    const ajuste = tipo === 'INC' ? cantidad : -cantidad;

    // Usar transacción para actualizar producto y registrar ajuste
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Actualizar el producto
      const productoActualizado = await tx.producto.update({
        where: { id_producto },
        data: {
          ajustes: {
            increment: ajuste
          },
          saldo_actual: {
            increment: ajuste
          }
        }
      });

      // 2. Crear registro en ajuste_inventario
      const ajusteInventario = await tx.ajuste_inventario.create({
        data: {
          descripcion: motivo || 'Ajuste manual de inventario',
          tipo: tipo === 'INC' ? 'E' : 'S', // E=Entrada, S=Salida
          num_productos: 1,
          estado: 'ACT'
        }
      });

      // 3. Crear detalle del ajuste en detalle_ajuste
      await tx.detalle_ajuste.create({
        data: {
          id_ajuste: ajusteInventario.id_ajuste,
          id_producto,
          cantidad: Math.abs(ajuste)
        }
      });

      return productoActualizado;
    });

    return res.json({
      status: 'success',
      message: 'Stock ajustado correctamente',
      data: {
        id_producto: resultado.id_producto,
        saldo_actual: resultado.saldo_actual,
        ajuste_aplicado: ajuste
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/productos/:id/stock
 * Consultar stock actual de un producto
 */
export const consultarStock = async (req, res, next) => {
  try {
    const id_producto = req.params.id;

    const producto = await prisma.producto.findUnique({
      where: { id_producto },
      select: {
        id_producto: true,
        descripcion: true,
        saldo_inicial: true,
        ingresos: true,
        egresos: true,
        ajustes: true,
        saldo_actual: true,
        estado: true
      }
    });

    if (!producto) {
      return res.status(404).json({
        status: 'error',
        message: 'Producto no encontrado',
        data: null
      });
    }

    res.json({
      status: 'success',
      message: 'Stock consultado correctamente',
      data: producto
    });
  } catch (err) {
    next(err);
  }
};
