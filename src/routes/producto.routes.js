import { Router } from 'express';
import {
  listarProductos,
  buscarProductos,
  crearProducto,
  actualizarProducto,
  cambiarEstadoProducto,
  eliminarProducto,
  ajustarStock
} from '../controllers/producto.controller.js';
import { contarProductos } from '../controllers/dashboard.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

// ========== RUTAS PÚBLICAS (E-commerce) ==========

// GET /api/v1/productos - Listar productos activos (público)
router.get('/', listarProductos);

// GET /api/v1/productos/count - Contar productos activos
router.get('/count', contarProductos);

// GET /api/v1/productos/buscar?id=&descripcion=&categoriaId=&estado=&precioMin=&precioMax= - Búsqueda unificada (público)
// Soporta búsqueda por: id, descripción, categoría, estado, rango de precios
router.get('/buscar', buscarProductos);

// ========== RUTAS PROTEGIDAS ==========

// POST /api/v1/productos - Crear producto (requiere auth)
router.post('/', verificarToken, crearProducto);

// PUT /api/v1/productos/:id - Actualizar producto (requiere auth)
router.put('/:id', verificarToken, actualizarProducto);

// PUT /api/v1/productos/:id/estado - Cambiar estado (ACT/INA)
router.put('/:id/estado', verificarToken, cambiarEstadoProducto);

// DELETE /api/v1/productos/:id - Eliminar lógico (requiere auth)
router.delete('/:id', verificarToken, eliminarProducto);

// POST /api/v1/productos/:id/ajustar-stock - Ajuste manual de inventario (requiere auth)
router.post('/:id/ajustar-stock', verificarToken, ajustarStock);

export default router;
