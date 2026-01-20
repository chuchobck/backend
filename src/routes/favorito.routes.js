// src/routes/favorito.routes.js
import { Router } from 'express';
import {
  listarFavoritos,
  agregarFavorito,
  eliminarFavorito
} from '../controllers/favorito.controller.js';

const router = Router();

// Listar favoritos de un usuario
// GET /api/v1/favoritos?usuarioId=123
router.get('/', listarFavoritos);

// Agregar producto a favoritos
// POST /api/v1/favoritos
router.post('/', agregarFavorito);

// Eliminar favorito
// DELETE /api/v1/favoritos/:id_favorito
router.delete('/:id_favorito', eliminarFavorito);

export default router;
