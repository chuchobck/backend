// src/routes/metodo-pago.routes.js
// Rutas para gestión de Métodos de Pago

import { Router } from 'express';
import {
  listarMetodosPago,
  obtenerMetodoPago,
  buscarMetodosPago,
  crearMetodoPago,
  actualizarMetodoPago,
  eliminarMetodoPago
} from '../controllers/metodo-pago.controller.js';
import { verificarToken } from '../middleware/auth.js';
import { soloAdmin } from '../middleware/validateRole.js';

const router = Router();

// GET /api/v1/metodos-pago - Listar métodos activos (público)
router.get('/', listarMetodosPago);

// GET /api/v1/metodos-pago/buscar - Buscar con filtros (público)
router.get('/buscar', buscarMetodosPago);

// GET /api/v1/metodos-pago/:id - Obtener por ID (público)
router.get('/:id', obtenerMetodoPago);

// POST /api/v1/metodos-pago - Crear método (Admin)
router.post('/', verificarToken, soloAdmin, crearMetodoPago);

// PUT /api/v1/metodos-pago/:id - Actualizar método (Admin)
router.put('/:id', verificarToken, soloAdmin, actualizarMetodoPago);

// DELETE /api/v1/metodos-pago/:id - Desactivar método (Admin)
router.delete('/:id', verificarToken, soloAdmin, eliminarMetodoPago);

export default router;
