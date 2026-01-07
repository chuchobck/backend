// src/routes/facturas.routes.js - Rutas de facturas
// 🟢 PERSONA 2: Módulo F5 ⭐ EL MÁS COMPLEJO

import { Router } from 'express';
import {
  listarFacturas,
  buscarFacturas,
  crearFactura,
  editarFacturaAbierta,
  modificarFacturaAprobada,
  anularFactura,
  imprimirFactura
} from '../controllers/facturas.controller.js';
import { verificarToken } from '../middleware/auth.js';
import { soloAdmin, adminOPos, soloPropiosDatos } from '../middleware/validateRole.js';

const router = Router();

// GET /api/v1/facturas - Listar facturas (Admin)
router.get('/', verificarToken, soloAdmin, listarFacturas);

// GET /api/v1/facturas/buscar?id=&cliente=&fechaDesde=&fechaHasta=&estado= - Búsqueda unificada (Admin)
// Soporta búsqueda por: id, cliente, fechas, estado
router.get('/buscar', verificarToken, soloAdmin, buscarFacturas);

// POST /api/v1/facturas - Crear factura
// E-commerce: estado ABI | POS: estado APR
router.post('/', verificarToken, crearFactura);

// PUT /api/v1/facturas/:id - Editar factura abierta (Cliente E-commerce)
router.put('/:id', verificarToken, editarFacturaAbierta);

// PUT /api/v1/facturas/:id/modificar - Modificar factura aprobada mismo día (Admin, POS)
router.put('/:id/modificar', verificarToken, adminOPos, modificarFacturaAprobada);

// POST /api/v1/facturas/:id/anular - Anular factura (Admin)
router.post('/:id/anular', verificarToken, soloAdmin, anularFactura);

// GET /api/v1/facturas/:id/imprimir - Generar PDF de factura
router.get('/:id/imprimir', verificarToken, imprimirFactura);

export default router;
