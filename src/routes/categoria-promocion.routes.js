// src/routes/categoria-promocion.routes.js
// Rutas para gestión de Categorías de Promoción

import { Router } from 'express';
import {
  listarCategoriasPromocion,
  buscarCategoriasPromocion,
  obtenerCategoriaPromocion,
  crearCategoriaPromocion,
  actualizarCategoriaPromocion,
  eliminarCategoriaPromocion
} from '../controllers/categoria-promocion.controller.js';
import { verificarToken } from '../middleware/auth.js';
import { soloAdmin } from '../middleware/validateRole.js';

const router = Router();

// GET /api/v1/categorias-promocion - Listar categorías activas (público)
router.get('/', listarCategoriasPromocion);

// GET /api/v1/categorias-promocion/buscar - Buscar categorías (público)
router.get('/buscar', buscarCategoriasPromocion);

// GET /api/v1/categorias-promocion/:id - Obtener por ID (público)
router.get('/:id', obtenerCategoriaPromocion);

// POST /api/v1/categorias-promocion - Crear categoría (Admin)
router.post('/', verificarToken, soloAdmin, crearCategoriaPromocion);

// PUT /api/v1/categorias-promocion/:id - Actualizar categoría (Admin)
router.put('/:id', verificarToken, soloAdmin, actualizarCategoriaPromocion);

// DELETE /api/v1/categorias-promocion/:id - Desactivar categoría (Admin)
router.delete('/:id', verificarToken, soloAdmin, eliminarCategoriaPromocion);

export default router;
