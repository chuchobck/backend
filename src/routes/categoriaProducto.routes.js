import { Router } from 'express';
import {
  listarCategorias,
  obtenerCategoria,
  buscarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria
} from '../controllers/categoriaProducto.controller.js';

const router = Router();

router.get('/', listarCategorias);
router.get('/buscar', buscarCategorias);
router.get('/:id', obtenerCategoria);
router.post('/', crearCategoria);
router.put('/:id', actualizarCategoria);
router.delete('/:id', eliminarCategoria);

export default router;
