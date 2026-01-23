// src/controllers/dashboard.controller.js
import prisma from '../lib/prisma.js';

/**
 * GET /api/v1/dashboard/ventas-mes
 * Obtener ventas del mes actual
 */
export const getVentasMes = async (req, res, next) => {
  try {
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const finMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    const facturas = await prisma.factura.findMany({
      where: {
        fecha_emision: {
          gte: inicioMes,
          lte: finMes
        },
        estado: 'EMI'
      }
    });

    const totalVentas = facturas.reduce((sum, f) => sum + Number(f.total), 0);
    const cantidadFacturas = facturas.length;

    return res.json({
      status: 'success',
      message: 'Ventas del mes obtenidas',
      data: {
        total: totalVentas,
        cantidad: cantidadFacturas,
        mes: new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/dashboard/top-productos
 * Obtener productos más vendidos
 */
export const getTopProductos = async (req, res, next) => {
  try {
    const { limit = 5 } = req.query;

    // Obtener productos más vendidos del último mes
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const topProductos = await prisma.detalle_factura.groupBy({
      by: ['id_producto'],
      _sum: {
        cantidad: true
      },
      orderBy: {
        _sum: {
          cantidad: 'desc'
        }
      },
      take: parseInt(limit)
    });

    // Obtener detalles de los productos
    const productosConDetalles = await Promise.all(
      topProductos.map(async (item) => {
        const producto = await prisma.producto.findUnique({
          where: { id_producto: item.id_producto },
          include: {
            marca: {
              select: { nombre: true }
            },
            categoria_producto: {
              select: { nombre: true }
            }
          }
        });

        return {
          id_producto: item.id_producto,
          descripcion: producto?.descripcion || 'N/A',
          marca: producto?.marca?.nombre || 'N/A',
          categoria: producto?.categoria_producto?.nombre || 'N/A',
          cantidad_vendida: item._sum.cantidad || 0
        };
      })
    );

    return res.json({
      status: 'success',
      message: `Top ${limit} productos más vendidos`,
      data: productosConDetalles
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/productos/count
 * Contar productos activos
 */
export const contarProductos = async (req, res, next) => {
  try {
    const count = await prisma.producto.count({
      where: { estado: 'ACT' }
    });

    return res.json({
      status: 'success',
      message: 'Conteo de productos',
      data: { count }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/clientes/count
 * Contar clientes activos
 */
export const contarClientes = async (req, res, next) => {
  try {
    const count = await prisma.cliente.count({
      where: { estado: 'ACT' }
    });

    return res.json({
      status: 'success',
      message: 'Conteo de clientes',
      data: { count }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/facturas/pendientes/count
 * Contar facturas pendientes
 */
export const contarFacturasPendientes = async (req, res, next) => {
  try {
    const count = await prisma.factura.count({
      where: { estado: 'PEN' }
    });

    return res.json({
      status: 'success',
      message: 'Conteo de facturas pendientes',
      data: { count }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/facturas/ventas-mes
 * Obtener resumen de ventas del mes
 */
export const getVentasMesFacturas = async (req, res, next) => {
  try {
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const finMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    const facturas = await prisma.factura.findMany({
      where: {
        fecha_emision: {
          gte: inicioMes,
          lte: finMes
        }
      }
    });

    const total = facturas.reduce((sum, f) => sum + Number(f.total), 0);

    return res.json({
      status: 'success',
      message: 'Ventas del mes',
      data: {
        total,
        cantidad: facturas.length
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/facturas/recientes
 * Obtener facturas recientes
 */
export const getFacturasRecientes = async (req, res, next) => {
  try {
    const { limit = 5 } = req.query;

    const facturas = await prisma.factura.findMany({
      take: parseInt(limit),
      orderBy: {
        fecha_emision: 'desc'
      },
      include: {
        cliente: {
          select: {
            nombre1: true,
            apellido1: true
          }
        }
      }
    });

    // Convertir Decimals a Numbers y formatear cliente como string
    const facturasConvertidas = facturas.map(f => ({
      id_factura: f.id_factura,
      numero_factura: f.numero_factura,
      fecha: f.fecha_emision,
      cliente: `${f.cliente.nombre1} ${f.cliente.apellido1}`,
      estado: f.estado,
      subtotal: Number(f.subtotal),
      iva: Number(f.iva),
      total: Number(f.total)
    }));

    return res.json({
      status: 'success',
      message: `${facturas.length} facturas recientes`,
      data: facturasConvertidas
    });
  } catch (err) {
    next(err);
  }
};
