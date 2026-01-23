// src/routes/bodega.routes.js - Rutas de recepciones de bodega
// 🔵 PERSONA 1: Módulo F3

import { Router } from 'express';
import {
  listarRecepciones,
  obtenerRecepcion,
  buscarRecepciones,
  registrarRecepcion,
  aprobarRecepcion,
  anularRecepcion,
  modificarRecepcion
} from '../controllers/bodega.controller.js';
import { verificarToken } from '../middleware/auth.js';
import { soloAdmin } from '../middleware/validateRole.js';

const router = Router();

// Todas las rutas requieren autenticación y rol admin
router.use(verificarToken, soloAdmin);

// GET /api/v1/bodega/recepciones - Listar recepciones
router.get('/recepciones', listarRecepciones);

// GET /api/v1/bodega/recepciones/buscar - Buscar recepciones por parámetros
router.get('/recepciones/buscar', buscarRecepciones);

// GET /api/v1/bodega/recepciones/:id - Obtener recepción con detalle
router.get('/recepciones/:id', obtenerRecepcion);

// POST /api/v1/bodega/recepciones - Registrar recepción
router.post('/recepciones', registrarRecepcion);

// POST /api/v1/bodega/recepciones/:id/aprobar - Aprobar recepción (actualiza stock)
router.post('/recepciones/:id/aprobar', aprobarRecepcion);

// POST /api/v1/bodega/recepciones/:id/anular - Anular recepción (revierte stock)
router.post('/recepciones/:id/anular', anularRecepcion);

// PUT /api/v1/bodega/recepciones/:id - Modificar cantidades (solo estado ABI)
router.put('/recepciones/:id', modificarRecepcion);

export default router;
