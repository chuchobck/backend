// src/routes/favorito.routes.js
import { Router } from 'express';
import {
  listarFavoritos,
  agregarFavorito,
  eliminarFavorito
} from '../controllers/favorito.controller.js';

const router = Router();

// Listar favoritos de un cliente
// GET /api/v1/favoritos?clienteId=123
router.get('/', listarFavoritos);

// Agregar producto a favoritos
// POST /api/v1/favoritos
// Body: { clienteId: 1, productoId: "P000001" }
router.post('/', agregarFavorito);

// Eliminar favorito
// DELETE /api/v1/favoritos/:productoId?clienteId=123
router.delete('/:productoId', eliminarFavorito);

export default router;
