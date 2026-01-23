// src/routes/dashboard.routes.js
import express from 'express';
import { 
  getVentasMes, 
  getTopProductos,
  contarProductos,
  contarClientes,
  contarFacturasPendientes,
  getVentasMesFacturas,
  getFacturasRecientes
} from '../controllers/dashboard.controller.js';

const router = express.Router();

// Dashboard endpoints
router.get('/ventas-mes', getVentasMes);
router.get('/top-productos', getTopProductos);

export default router;
