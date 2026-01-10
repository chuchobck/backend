import { Router } from 'express';
import {
  listarSucursales,
  buscarSucursales,
  obtenerSucursal,
  crearSucursal,
  actualizarSucursal,
  eliminarSucursal
} from '../controllers/sucursal.controller.js';

const router = Router();

// Nota: /buscar antes de /:id
router.get('/buscar', buscarSucursales);
router.get('/', listarSucursales);
router.get('/:id', obtenerSucursal);
router.post('/', crearSucursal);
router.put('/:id', actualizarSucursal);
router.delete('/:id', eliminarSucursal);

export default router;
