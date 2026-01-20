// src/routes/proveedor.routes.js - Rutas de proveedor
// 🔵 PERSONA 1: Módulo F1

import { Router } from 'express';
import {
  listarProveedores,
  obtenerProveedor,
  buscarProveedores,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor
} from '../controllers/proveedor.controller.js';
import { verificarToken } from '../middleware/auth.js';
import { soloAdmin } from '../middleware/validateRole.js';

const router = Router();

// Todas las rutas requieren autenticación y rol admin
router.use(verificarToken, soloAdmin);

// GET /api/v1/proveedores - Listar todos los proveedores
router.get('/', listarProveedores);

// GET /api/v1/proveedores/buscar?ruc=&nombre=&ciudad= - Buscar proveedores
router.get('/buscar', buscarProveedores);

// GET /api/v1/proveedores/:id - Obtener proveedor por ID
router.get('/:id', obtenerProveedor);

// POST /api/v1/proveedores - Crear nuevo proveedor
router.post('/', crearProveedor);

// PUT /api/v1/proveedores/:id - Actualizar proveedor
router.put('/:id', actualizarProveedor);

// DELETE /api/v1/proveedores/:id - Eliminar lógico (estado → INA)
router.delete('/:id', eliminarProveedor);

export default router;
