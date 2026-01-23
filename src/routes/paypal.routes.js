// src/routes/paypal.routes.js - Rutas de PayPal
// � PERSONA 2: Integración PayPal

import { Router } from 'express';
import {
  crearOrdenPayPal,
  confirmarPagoPayPal
} from '../controllers/paypal.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// POST /api/v1/paypal/crear-orden - Crear orden de pago en PayPal
router.post('/crear-orden', crearOrdenPayPal);

// POST /api/v1/paypal/confirmar - Confirmar pago de PayPal
router.post('/confirmar', confirmarPagoPayPal);

export default router;
