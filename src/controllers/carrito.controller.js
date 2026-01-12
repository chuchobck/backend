// =============================================
// 🛒 CARRITO CONTROLLER
// Flujo: sessionId (no logeado) → Login → Asociar a cliente → Checkout (requiere login) → Factura
// =============================================
import prisma from '../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * GET /api/v1/carrito?sessionId=xxx&clienteId=xxx
 * Obtener carrito por sessionId (no logeado) o clienteId (logeado)
 * - Si clienteId: buscar carrito del cliente
 * - Si sessionId: buscar carrito por session (sin cliente)
 */
export const obtenerCarrito = async (req, res, next) => {
  try {
    const { sessionId, clienteId } = req.query;

    if (!sessionId && !clienteId) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere sessionId o clienteId',
        data: null
      });
    }

    let carrito;

    // Priorizar búsqueda por cliente si está logeado
    if (clienteId) {
      carrito = await prisma.carrito.findFirst({
        where: { 
          id_cliente: parseInt(clienteId), 
          estado: 'ACT'
        },
        include: { 
          carrito_detalle: { 
            include: { 
              producto: {
                select: {
                  id_producto: true,
                  descripcion: true,
                  precioVenta: true,
                  imagen_url: true,
                  saldo_actual: true,
                  estado: true,
                  marca: {
                    select: {
                      id_marca: true,
                      nombre: true
                    }
                  }
                }
              }
            },
            orderBy: { fecha_agregado: 'desc' }
          },
          cliente: {
            select: {
              id_cliente: true,
              nombre1: true,
              apellido1: true,
              email: true
            }
          }
        }
      });
    } else if (sessionId) {
      // Buscar por session_id (usuario no logeado)
      carrito = await prisma.carrito.findFirst({
        where: { 
          session_id: sessionId,
          id_cliente: null, // Sin cliente asignado
          estado: 'ACT'
        },
        include: { 
          carrito_detalle: { 
            include: { 
              producto: {
                select: {
                  id_producto: true,
                  descripcion: true,
                  precioVenta: true,
                  imagen_url: true,
                  saldo_actual: true,
                  estado: true,
                  marca: {
                    select: {
                      id_marca: true,
                      nombre: true
                    }
                  }
                }
              }
            },
            orderBy: { fecha_agregado: 'desc' }
          }
        }
      });
    }

    if (!carrito) {
      return res.json({
        status: 'success',
        message: 'No hay carrito activo',
        data: null,
        isEmpty: true
      });
    }

    // Validar disponibilidad de productos
    const productosConValidacion = carrito.carrito_detalle.map(detalle => ({
      ...detalle,
      disponible: detalle.producto.estado === 'ACT' && detalle.producto.saldo_actual >= detalle.cantidad,
      stock_disponible: detalle.producto.saldo_actual
    }));

    return res.json({
      status: 'success',
      message: 'Carrito obtenido exitosamente',
      data: {
        ...carrito,
        carrito_detalle: productosConValidacion,
        cantidad_items: carrito.carrito_detalle.length,
        total_productos: carrito.carrito_detalle.reduce((sum, item) => sum + item.cantidad, 0)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/carrito
 * Crear carrito vacío
 * Body: { sessionId?: string, clienteId?: number }
 */
export const crearCarrito = async (req, res, next) => {
  try {
    const { sessionId, clienteId } = req.body;

    if (!sessionId && !clienteId) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere sessionId o clienteId',
        data: null
      });
    }

    // Si hay clienteId, verificar que el cliente existe
    if (clienteId) {
      const cliente = await prisma.cliente.findUnique({
        where: { id_cliente: parseInt(clienteId) }
      });

      if (!cliente) {
        return res.status(404).json({
          status: 'error',
          message: 'Cliente no encontrado',
          data: null
        });
      }

      // Verificar si ya tiene carrito activo
      const carritoExistente = await prisma.carrito.findFirst({
        where: { 
          id_cliente: parseInt(clienteId), 
          estado: 'ACT'
        },
        include: { 
          carrito_detalle: { 
            include: { producto: true } 
          } 
        }
      });

      if (carritoExistente) {
        return res.json({
          status: 'success',
          message: 'Ya existe un carrito activo para este cliente',
          data: carritoExistente,
          isExisting: true
        });
      }
    } else if (sessionId) {
      // Verificar si ya existe carrito con este sessionId
      const carritoExistente = await prisma.carrito.findFirst({
        where: { 
          session_id: sessionId,
          id_cliente: null,
          estado: 'ACT'
        },
        include: { 
          carrito_detalle: { 
            include: { producto: true } 
          } 
        }
      });

      if (carritoExistente) {
        return res.json({
          status: 'success',
          message: 'Ya existe un carrito activo para esta sesión',
          data: carritoExistente,
          isExisting: true
        });
      }
    }

    // Crear nuevo carrito
    const nuevoCarrito = await prisma.carrito.create({
      data: {
        id_cliente: clienteId ? parseInt(clienteId) : null,
        session_id: sessionId || null,
        subtotal: new Decimal(0),
        total: new Decimal(0),
        estado: 'ACT',
        fecha_creacion: new Date()
      },
      include: { 
        carrito_detalle: true,
        cliente: clienteId ? {
          select: {
            id_cliente: true,
            nombre1: true,
            apellido1: true,
            email: true
          }
        } : false
      }
    });

    return res.status(201).json({
      status: 'success',
      message: 'Carrito creado exitosamente',
      data: nuevoCarrito
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/carrito/:id_carrito/productos
 * Agregar producto al carrito
 * Body: { id_producto: string, cantidad: number }
 */
export const agregarProducto = async (req, res, next) => {
  try {
    const { id_carrito } = req.params;
    const { id_producto, cantidad = 1 } = req.body;

    // Validaciones
    if (!id_producto) {
      return res.status(400).json({
        status: 'error',
        message: 'id_producto es requerido',
        data: null
      });
    }

    if (!cantidad || cantidad < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'La cantidad debe ser mayor o igual a 1',
        data: null
      });
    }

    // Verificar que el carrito existe y está activo
    const carrito = await prisma.carrito.findUnique({
      where: { id_carrito }
    });

    if (!carrito) {
      return res.status(404).json({
        status: 'error',
        message: 'Carrito no encontrado',
        data: null
      });
    }

    if (carrito.estado !== 'ACT') {
      return res.status(400).json({
        status: 'error',
        message: 'El carrito no está activo',
        data: null
      });
    }

    // Verificar que el producto existe y está disponible
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

    if (producto.estado !== 'ACT') {
      return res.status(400).json({
        status: 'error',
        message: 'El producto no está disponible',
        data: null
      });
    }

    const precioUnitario = producto.precioVenta;

    // Verificar si el producto ya está en el carrito
    const detalleExistente = await prisma.carrito_detalle.findUnique({
      where: { 
        id_carrito_id_producto: { 
          id_carrito, 
          id_producto 
        } 
      }
    });

    let nuevaCantidad = cantidad;
    
    if (detalleExistente) {
      // Actualizar cantidad existente
      nuevaCantidad = detalleExistente.cantidad + cantidad;
      
      // Verificar stock disponible
      if (producto.saldo_actual < nuevaCantidad) {
        return res.status(400).json({
          status: 'error',
          message: `Stock insuficiente. Disponible: ${producto.saldo_actual}`,
          data: { stock_disponible: producto.saldo_actual }
        });
      }

      await prisma.carrito_detalle.update({
        where: { 
          id_carrito_id_producto: { 
            id_carrito, 
            id_producto 
          } 
        },
        data: {
          cantidad: nuevaCantidad,
          subtotal: new Decimal(nuevaCantidad).mul(precioUnitario)
        }
      });
    } else {
      // Verificar stock disponible
      if (producto.saldo_actual < cantidad) {
        return res.status(400).json({
          status: 'error',
          message: `Stock insuficiente. Disponible: ${producto.saldo_actual}`,
          data: { stock_disponible: producto.saldo_actual }
        });
      }

      // Crear nuevo detalle
      await prisma.carrito_detalle.create({
        data: {
          id_carrito,
          id_producto,
          cantidad,
          precio_unitario: precioUnitario,
          subtotal: new Decimal(cantidad).mul(precioUnitario),
          fecha_agregado: new Date()
        }
      });
    }

    // Recalcular totales del carrito
    const carritoActualizado = await recalcularCarrito(id_carrito);

    return res.json({
      status: 'success',
      message: 'Producto agregado al carrito',
      data: carritoActualizado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/carrito/:id_carrito/productos/:id_producto
 * Actualizar cantidad de un producto en el carrito
 * Body: { cantidad: number }
 */
export const actualizarCantidad = async (req, res, next) => {
  try {
    const { id_carrito, id_producto } = req.params;
    const { cantidad } = req.body;

    if (!cantidad || cantidad < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'La cantidad debe ser mayor o igual a 1',
        data: null
      });
    }

    // Verificar que el detalle existe
    const detalle = await prisma.carrito_detalle.findUnique({
      where: { 
        id_carrito_id_producto: { 
          id_carrito, 
          id_producto 
        } 
      },
      include: { producto: true }
    });

    if (!detalle) {
      return res.status(404).json({
        status: 'error',
        message: 'Producto no encontrado en el carrito',
        data: null
      });
    }

    // Verificar stock disponible
    if (detalle.producto.saldo_actual < cantidad) {
      return res.status(400).json({
        status: 'error',
        message: `Stock insuficiente. Disponible: ${detalle.producto.saldo_actual}`,
        data: { stock_disponible: detalle.producto.saldo_actual }
      });
    }

    // Actualizar cantidad
    await prisma.carrito_detalle.update({
      where: { 
        id_carrito_id_producto: { 
          id_carrito, 
          id_producto 
        } 
      },
      data: {
        cantidad,
        subtotal: new Decimal(cantidad).mul(detalle.precio_unitario)
      }
    });

    // Recalcular totales del carrito
    const carritoActualizado = await recalcularCarrito(id_carrito);

    return res.json({
      status: 'success',
      message: 'Cantidad actualizada',
      data: carritoActualizado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/carrito/:id_carrito/productos/:id_producto
 * Eliminar producto del carrito
 */
export const eliminarProducto = async (req, res, next) => {
  try {
    const { id_carrito, id_producto } = req.params;

    // Verificar que el detalle existe
    const detalle = await prisma.carrito_detalle.findUnique({
      where: { 
        id_carrito_id_producto: { 
          id_carrito, 
          id_producto 
        } 
      }
    });

    if (!detalle) {
      return res.status(404).json({
        status: 'error',
        message: 'Producto no encontrado en el carrito',
        data: null
      });
    }

    // Eliminar detalle
    await prisma.carrito_detalle.delete({
      where: { 
        id_carrito_id_producto: { 
          id_carrito, 
          id_producto 
        } 
      }
    });

    // Recalcular totales del carrito
    const carritoActualizado = await recalcularCarrito(id_carrito);

    return res.json({
      status: 'success',
      message: 'Producto eliminado del carrito',
      data: carritoActualizado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/carrito/:id_carrito
 * Vaciar carrito (eliminar todos los productos)
 */
export const vaciarCarrito = async (req, res, next) => {
  try {
    const { id_carrito } = req.params;

    // Verificar que el carrito existe
    const carrito = await prisma.carrito.findUnique({
      where: { id_carrito }
    });

    if (!carrito) {
      return res.status(404).json({
        status: 'error',
        message: 'Carrito no encontrado',
        data: null
      });
    }

    // Eliminar todos los detalles
    await prisma.carrito_detalle.deleteMany({
      where: { id_carrito }
    });

    // Resetear totales
    const carritoActualizado = await prisma.carrito.update({
      where: { id_carrito },
      data: {
        subtotal: new Decimal(0),
        total: new Decimal(0),
        fecha_actualizacion: new Date()
      },
      include: {
        carrito_detalle: true
      }
    });

    return res.json({
      status: 'success',
      message: 'Carrito vaciado',
      data: carritoActualizado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/carrito/:id_carrito/asociar-cliente
 * Asociar carrito de sesión a un cliente (después de login/registro)
 * Body: { clienteId: number }
 */
export const asociarClienteAlCarrito = async (req, res, next) => {
  try {
    const { id_carrito } = req.params;
    const { clienteId } = req.body;

    if (!clienteId) {
      return res.status(400).json({
        status: 'error',
        message: 'clienteId es requerido',
        data: null
      });
    }

    // Verificar que el carrito existe y no tiene cliente
    const carrito = await prisma.carrito.findUnique({
      where: { id_carrito },
      include: { carrito_detalle: true }
    });

    if (!carrito) {
      return res.status(404).json({
        status: 'error',
        message: 'Carrito no encontrado',
        data: null
      });
    }

    if (carrito.id_cliente) {
      return res.status(400).json({
        status: 'error',
        message: 'El carrito ya está asociado a un cliente',
        data: null
      });
    }

    // Verificar que el cliente existe
    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: parseInt(clienteId) }
    });

    if (!cliente) {
      return res.status(404).json({
        status: 'error',
        message: 'Cliente no encontrado',
        data: null
      });
    }

    // Verificar si el cliente ya tiene un carrito activo
    const carritoClienteExistente = await prisma.carrito.findFirst({
      where: { 
        id_cliente: parseInt(clienteId), 
        estado: 'ACT'
      },
      include: { carrito_detalle: true }
    });

    if (carritoClienteExistente && carritoClienteExistente.id_carrito !== id_carrito) {
      // Merge: Mover productos del carrito de sesión al carrito del cliente
      for (const detalle of carrito.carrito_detalle) {
        const detalleExistente = await prisma.carrito_detalle.findUnique({
          where: {
            id_carrito_id_producto: {
              id_carrito: carritoClienteExistente.id_carrito,
              id_producto: detalle.id_producto
            }
          }
        });

        if (detalleExistente) {
          // Sumar cantidades
          await prisma.carrito_detalle.update({
            where: {
              id_carrito_id_producto: {
                id_carrito: carritoClienteExistente.id_carrito,
                id_producto: detalle.id_producto
              }
            },
            data: {
              cantidad: detalleExistente.cantidad + detalle.cantidad,
              subtotal: new Decimal(detalleExistente.cantidad + detalle.cantidad).mul(detalle.precio_unitario)
            }
          });
        } else {
          // Mover el detalle al carrito del cliente
          await prisma.carrito_detalle.create({
            data: {
              id_carrito: carritoClienteExistente.id_carrito,
              id_producto: detalle.id_producto,
              cantidad: detalle.cantidad,
              precio_unitario: detalle.precio_unitario,
              subtotal: detalle.subtotal,
              fecha_agregado: new Date()
            }
          });
        }
      }

      // Desactivar carrito de sesión
      await prisma.carrito.update({
        where: { id_carrito },
        data: { estado: 'INA' }
      });

      // Recalcular totales del carrito del cliente
      const carritoFinal = await recalcularCarrito(carritoClienteExistente.id_carrito);

      return res.json({
        status: 'success',
        message: 'Carrito de sesión fusionado con carrito del cliente',
        data: carritoFinal,
        merged: true
      });
    }

    // Asociar carrito de sesión al cliente
    const carritoActualizado = await prisma.carrito.update({
      where: { id_carrito },
      data: {
        id_cliente: parseInt(clienteId),
        session_id: null, // Limpiar session_id
        fecha_actualizacion: new Date()
      },
      include: {
        carrito_detalle: {
          include: { producto: true }
        },
        cliente: {
          select: {
            id_cliente: true,
            nombre1: true,
            apellido1: true,
            email: true
          }
        }
      }
    });

    return res.json({
      status: 'success',
      message: 'Carrito asociado al cliente exitosamente',
      data: carritoActualizado
    });
  } catch (err) {
    next(err);
  }
};

// =============================================
// FUNCIONES AUXILIARES
// =============================================

/**
 * Recalcular totales del carrito
 */
async function recalcularCarrito(id_carrito) {
  const detalles = await prisma.carrito_detalle.findMany({
    where: { id_carrito }
  });

  const subtotal = detalles.reduce((sum, d) => sum.add(d.subtotal), new Decimal(0));
  const total = subtotal; // Si hay descuentos, aplicarlos aquí

  const carritoActualizado = await prisma.carrito.update({
    where: { id_carrito },
    data: {
      subtotal,
      total,
      fecha_actualizacion: new Date()
    },
    include: {
      carrito_detalle: {
        include: { producto: true },
        orderBy: { fecha_agregado: 'desc' }
      },
      cliente: {
        select: {
          id_cliente: true,
          nombre1: true,
          apellido1: true,
          email: true
        }
      }
    }
  });

  return carritoActualizado;
}

export default {
  obtenerCarrito,
  crearCarrito,
  agregarProducto,
  actualizarCantidad,
  eliminarProducto,
  vaciarCarrito,
  asociarClienteAlCarrito
};
