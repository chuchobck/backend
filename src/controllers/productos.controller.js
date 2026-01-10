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
        categoria: true,
        unidadMedida: true
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
 * F6.4.2 - Consulta de productos por parámetros
 * Búsqueda unificada por: id, descripción, categoría, estado, rango de precios
 */
export const buscarProductos = async (req, res, next) => {
  try {
    const { id, descripcion, categoriaId, estado, precioMin, precioMax } = req.query;

    // Si se busca por ID, usar findUnique
    if (id) {
      const producto = await prisma.producto.findUnique({
        where: { id_producto: id },
        include: {
          categoria: true,
          unidadMedida: true
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

    // Búsqueda con múltiples filtros
    const whereConditions = {};

    if (descripcion) {
      whereConditions.descripcion = { contains: descripcion, mode: 'insensitive' };
    }

    if (categoriaId) {
      whereConditions.categoriaId = Number(categoriaId);
    }

    if (estado) {
      whereConditions.estado = estado;
    }

    if (precioMin || precioMax) {
      whereConditions.precioVenta = {};
      if (precioMin) {
        whereConditions.precioVenta.gte = Number(precioMin);
      }
      if (precioMax) {
        whereConditions.precioVenta.lte = Number(precioMax);
      }
    }

    const productos = await prisma.producto.findMany({
      where: whereConditions,
      include: {
        categoria: true,
        unidadMedida: true
      }
    });

    // E6: Sin resultados
    if (productos.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron productos con los criterios especificados',
        data: []
      });
    }

    return res.json({
      status: 'success',
      message: 'Búsqueda completada',
      data: productos
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/productos
 * F6.1 Ingreso de Producto
 */
export const crearProducto = async (req, res, next) => {
  try {
    const {
      id_producto,
      descripcion,
      precioCompra,
      precioVenta,
      saldoInicial,
      categoriaId,
      unidadMedidaId,
      proveedorId
    } = req.body;

    // E5 – Datos obligatorios
    if (!id_producto || !descripcion || !precioVenta || !categoriaId || !unidadMedidaId) {
      return res.status(400).json({
        status: 'error',
        message: 'Complete todos los campos requeridos',
        data: null
      });
    }

    // E6 – Precio inválido
    if (precioVenta <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'El precio debe ser un valor numérico positivo',
        data: null
      });
    }

    // E2 – Producto duplicado
    const existeProducto = await prisma.producto.findUnique({
      where: { id_producto }
    });

    if (existeProducto) {
      return res.status(409).json({
        status: 'error',
        message: 'El identificador del producto ya existe',
        data: null
      });
    }

    // E3 – Categoría inexistente
    const categoria = await prisma.categoria.findUnique({
      where: { id_categoria: categoriaId }
    });
    if (!categoria) {
      return res.status(400).json({
        status: 'error',
        message: 'La categoría seleccionada no es válida',
        data: null
      });
    }

    // E4 – Proveedor inexistente (si aplica)
    if (proveedorId) {
      const proveedor = await prisma.proveedor.findUnique({
        where: { id_proveedor: proveedorId }
      });
      if (!proveedor) {
        return res.status(400).json({
          status: 'error',
          message: 'El proveedor seleccionado no es válido',
          data: null
        });
      }
    }

    const nuevoProducto = await prisma.producto.create({
      data: {
        id_producto,
        descripcion,
        precioCompra,
        precioVenta,
        saldo_inicial: saldoInicial || 0,
        categoriaId,
        unidadMedidaId,
        proveedorId,
        estado: 'ACT'
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
 * Permite actualizar: descripcion, precio_venta, precio_compra, categoría, marca, unidades de medida
 * NO permite actualizar campos de inventario
 */
export const actualizarProducto = async (req, res, next) => {
  try {
    const id_producto = req.params.id; // VARCHAR
    const { descripcion, precio_venta, precio_compra, id_categoria, id_marca, id_um_compra, id_um_venta } = req.body;

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
      dataActualizar.precioVenta = precio_venta;
    }

    if (precio_compra !== undefined) {
      if (precio_compra <= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'El precio de compra debe ser un valor numérico positivo',
          data: null
        });
      }
      dataActualizar.precioCompra = precio_compra;
    }

    if (id_categoria !== undefined) {
      // Validar que la nueva categoría existe
      const categoria = await prisma.categoria.findUnique({
        where: { id_categoria }
      });

      if (!categoria) {
        return res.status(404).json({
          status: 'error',
          message: 'La categoría especificada no existe',
          data: null
        });
      }
      dataActualizar.categoriaId = id_categoria;
    }

    if (id_marca !== undefined) {
      dataActualizar.marcaId = id_marca;
    }

    if (id_um_compra !== undefined) {
      dataActualizar.unidadMedidaIdCompra = id_um_compra;
    }

    if (id_um_venta !== undefined) {
      dataActualizar.unidadMedidaId = id_um_venta;
    }

    // Actualizar el producto
    const productoActualizado = await prisma.producto.update({
      where: { id_producto },
      data: dataActualizar,
      include: {
        categoria: true,
        unidadMedida: true
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
 * DELETE /api/v1/productos/:id
 * F6.3 Eliminación lógica
 */
export const eliminarProducto = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const producto = await prisma.producto.findUnique({
      where: { id_producto: id }
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
      where: { id_producto: id },
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
    const id = req.params.id; // VARCHAR
    const { cantidad, motivo, tipo } = req.body;

    if (!id) {
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
      where: { id_producto: id }
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
        where: { id_producto: id },
        data: {
          ajustes: {
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
          id_producto: id,
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
