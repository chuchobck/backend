import prisma from '../lib/prisma.js';

/**
 * Controller de consulta para `factura_detalle` (solo lectura)
 */

/**
 * GET /api/v1/facturas/:id_factura/detalle
 */
export const obtenerDetalleFactura = async (req, res, next) => {
  try {
    const id_factura = req.params.id_factura;
    if (!id_factura) {
      return res.status(400).json({ status: 'error', message: 'id_factura es requerido', data: null });
    }

    // Validar que la factura existe
    const factura = await prisma.factura.findUnique({ where: { id_factura } });
    if (!factura) {
      return res.status(404).json({ status: 'error', message: 'Factura no encontrada', data: null });
    }

    // Obtener detalles (puede devolver vacío)
    const detalles = await prisma.factura_detalle.findMany({
      where: { id_factura },
      include: {
        producto: {
          select: { id_producto: true, descripcion: true, imagen_url: true }
        }
      },
      orderBy: { id_producto: 'asc' }
    });

    return res.json({ status: 'success', message: 'Detalles obtenidos', data: detalles });
  } catch (err) {
    next(err);
  }
};


/**
 * GET /api/v1/facturas/detalle/producto/:id_producto
 * Lista todas las facturas que contienen un producto
 */
export const obtenerDetalleProducto = async (req, res, next) => {
  try {
    const id_producto = req.params.id_producto;
    if (!id_producto) {
      return res.status(400).json({ status: 'error', message: 'id_producto es requerido', data: null });
    }

    const detalles = await prisma.factura_detalle.findMany({
      where: { id_producto },
      include: {
        factura: {
          select: { id_factura: true, fecha_emision: true, total: true, estado: true }
        }
      },
      orderBy: { factura: { fecha_emision: 'desc' } }
    });

    if (!detalles || detalles.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No se encontraron ventas de este producto', data: [] });
    }

    return res.json({ status: 'success', message: 'Historial de ventas obtenido', data: detalles });
  } catch (err) {
    next(err);
  }
};


/**
 * GET /api/v1/facturas/detalle/estadisticas/:id_producto
 * Estadísticas de ventas por producto
 */
export const obtenerEstadisticasProducto = async (req, res, next) => {
  try {
    const id_producto = req.params.id_producto;
    if (!id_producto) {
      return res.status(400).json({ status: 'error', message: 'id_producto es requerido', data: null });
    }

    // Agregados básicos: total vendido (suma), precio promedio
    const agregados = await prisma.factura_detalle.aggregate({
      where: { id_producto },
      _sum: { cantidad: true },
      _avg: { precio_unitario: true }
    });

    // Contar facturas distintas que contienen el producto
    const grupos = await prisma.factura_detalle.groupBy({
      by: ['id_factura'],
      where: { id_producto }
    });

    const total_facturas = grupos.length;

    // Última venta por fecha_emision de factura
    const ultimaFactura = await prisma.factura.findFirst({
      where: { factura_detalle: { some: { id_producto } } },
      orderBy: { fecha_emision: 'desc' },
      select: { fecha_emision: true }
    });

    const total_vendido = agregados._sum?.cantidad ?? 0;
    const precio_promedio = agregados._avg?.precio_unitario ? Number(agregados._avg.precio_unitario) : 0;
    const ultima_venta = ultimaFactura?.fecha_emision ?? null;

    return res.json({
      status: 'success',
      message: 'Estadísticas obtenidas',
      data: {
        total_vendido,
        total_facturas,
        precio_promedio,
        ultima_venta
      }
    });
  } catch (err) {
    next(err);
  }
};

export default null;
