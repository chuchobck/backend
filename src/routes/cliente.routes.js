// src/routes/cliente.routes.js - Rutas de cliente
// 🟢 PERSONA 2: Módulo F4

import { Router } from 'express';
import {
  listarClientes,
  buscarClientes,
  crearCliente,
  actualizarCliente,
  eliminarCliente
} from '../controllers/cliente.controller.js';
import { verificarToken, verificarTokenOpcional } from '../middleware/auth.js';
import { adminOPos, soloPropiosDatos } from '../middleware/validateRole.js';

const router = Router();

// GET /api/v1/clientes - Listar todos (Admin y POS)
router.get('/', verificarToken, adminOPos, listarClientes);

// GET /api/v1/clientes/buscar?id=&nombre=&cedula=&estado= - Búsqueda unificada (Admin, POS)
// Soporta búsqueda por: id, nombre, cédula o estado
router.get('/buscar', verificarToken, adminOPos, buscarClientes);

// POST /api/v1/clientes - Crear cliente (Admin, E-commerce registro, POS)
router.post('/', verificarTokenOpcional, crearCliente);

// PUT /api/v1/clientes/:id - Actualizar (Admin, Cliente propio)
router.put('/:id', verificarToken, soloPropiosDatos('id'), actualizarCliente);

// DELETE /api/v1/clientes/:id - Eliminar lógico (Solo Admin)
router.delete('/:id', verificarToken, adminOPos, eliminarCliente);

export default router;
