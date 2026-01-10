import { Router } from 'express';
import {
  obtenerDetalleFactura,
  obtenerDetalleProducto,
  obtenerEstadisticasProducto
} from '../controllers/facturaDetalle.controller.js';

const router = Router();

// Rutas de consulta para factura_detalle
router.get('/:id_factura/detalle', obtenerDetalleFactura);
router.get('/detalle/producto/:id_producto', obtenerDetalleProducto);
router.get('/detalle/estadisticas/:id_producto', obtenerEstadisticasProducto);

export default router;
