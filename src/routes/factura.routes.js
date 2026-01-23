// src/routes/factura.routes.js - Rutas de factura
// 🟢 PERSONA 2: Módulo F5 ⭐ EL MÁS COMPLEJO

import { Router } from 'express';
import {
  listarFacturas,
  buscarFacturas,
  crearFactura,
  anularFactura,
  imprimirFactura,
  facturasCliente,
  misPedidos,
  pedidosPendientesRetiro,
  marcarRetirado
} from '../controllers/factura.controller.js';
import { 
  contarFacturasPendientes, 
  getVentasMesFacturas, 
  getFacturasRecientes 
} from '../controllers/dashboard.controller.js';
import { verificarToken } from '../middleware/auth.js';
import { soloAdmin, adminOPos, soloPropiosDatos } from '../middleware/validateRole.js';

const router = Router();

// Rutas específicas ANTES de /:id
router.get('/mis-pedidos', verificarToken, misPedidos); // Historial del cliente autenticado
router.get('/pedidos-retiro', verificarToken, adminOPos, pedidosPendientesRetiro); // Pedidos pendientes (POS)
router.get('/pendientes/count', contarFacturasPendientes); // Contador de pendientes
router.get('/ventas-mes', getVentasMesFacturas); // Ventas del mes
router.get('/recientes', getFacturasRecientes); // Facturas recientes
router.get('/cliente/:id_cliente', verificarToken, facturasCliente); // Facturas de un cliente específico
router.get('/buscar', verificarToken, soloAdmin, buscarFacturas); // Búsqueda unificada (Admin)

// Rutas generales
router.get('/', verificarToken, soloAdmin, listarFacturas); // Listar facturas (Admin)
router.post('/', verificarToken, crearFactura); // Crear factura (Checkout)

// Rutas con parámetros
router.post('/:id/marcar-retirado', verificarToken, adminOPos, marcarRetirado); // Marcar pedido retirado (POS)
router.get('/:id/imprimir', verificarToken, imprimirFactura); // Generar PDF
router.post('/:id/anular', verificarToken, soloAdmin, anularFactura); // Anular factura (Admin)
router.get('/:id', verificarToken, buscarFacturas); // Obtener factura por ID (usa buscarFacturas)

export default router;
