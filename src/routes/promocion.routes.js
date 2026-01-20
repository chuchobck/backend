// src/routes/promociones.routes.js - Rutas para promociones
import { Router } from 'express';
import {
  listarPromociones,
  obtenerPromocion,
  obtenerPromocionesActivas,
  buscarPromociones,
  crearPromocion,
  actualizarPromocion,
  eliminarPromocion,
  incrementarVendida
} from '../controllers/promocion.controller.js';

const router = Router();

// ========== RUTAS PRINCIPALES DE PROMOCIONES ==========

// GET /api/v1/promociones/activas - Promociones activas (debe ir antes de /buscar y /:id)
router.get('/activas', obtenerPromocionesActivas);

// GET /api/v1/promociones/buscar - Buscar promociones con filtros
router.get('/buscar', buscarPromociones);

// GET /api/v1/promociones - Listar todas las promociones
router.get('/', listarPromociones);

// GET /api/v1/promociones/:id - Obtener promoción específica
router.get('/:id', obtenerPromocion);

// POST /api/v1/promociones - Crear nueva promoción
router.post('/', crearPromocion);

// PUT /api/v1/promociones/:id - Actualizar promoción
router.put('/:id', actualizarPromocion);

// DELETE /api/v1/promociones/:id - Eliminar (desactivar) promoción
router.delete('/:id', eliminarPromocion);

// POST /api/v1/promociones/:id/vender - Registrar venta de promoción
router.post('/:id/vender', incrementarVendida);

export default router;
