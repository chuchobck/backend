// src/routes/compra.routes.js - Rutas de órdenes de compra
// 🔵 PERSONA 1: Módulo F2

import { Router } from 'express';
import {
  listarCompras,
  obtenerCompra,
  buscarCompras,
  crearCompra,
  actualizarCompra,
  anularCompra
} from '../controllers/compra.controller.js';
import { verificarToken } from '../middleware/auth.js';
import { soloAdmin } from '../middleware/validateRole.js';

const router = Router();

// Todas las rutas requieren autenticación y rol admin
router.use(verificarToken, soloAdmin);

// GET /api/v1/compras - Listar órdenes de compra
router.get('/', listarCompras);

// GET /api/v1/compras/buscar?proveedor=&fecha=&estado= - Buscar órdenes
router.get('/buscar', buscarCompras);

// GET /api/v1/compras/:id - Obtener orden con detalle
router.get('/:id', obtenerCompra);

// POST /api/v1/compras - Crear orden de compra
router.post('/', crearCompra);

// PUT /api/v1/compras/:id - Actualizar orden (solo si ACT)
router.put('/:id', actualizarCompra);

// DELETE /api/v1/compras/:id - Anular orden (estado → ANU)
router.delete('/:id', anularCompra);

export default router;
