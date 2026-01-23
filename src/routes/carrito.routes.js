// � carrito.routes.js
import { Router } from 'express';
import {
  obtenerCarrito,
  crearCarrito,
  agregarProducto,
  actualizarCantidad,
  eliminarProducto,
  vaciarCarrito,
  asociarClienteAlCarrito
} from '../controllers/carrito.controller.js';import { validarUUID } from '../middleware/validarUUID.js';
const router = Router();

// 🔹 Obtener carrito por sessionId o clienteId
// GET /api/v1/carrito?sessionId=xxx&clienteId=xxx
router.get('/', obtenerCarrito);

// 🔹 Crear carrito vacío
// POST /api/v1/carrito
// Body: { sessionId?: string, clienteId?: number }
router.post('/', crearCarrito);

// 🔹 Agregar producto al carrito
// POST /api/v1/carrito/:id_carrito/productos
// Body: { id_producto: string, cantidad: number }
// ✅ Con validación UUID
router.post('/:id_carrito/productos', validarUUID, agregarProducto);

// 🔹 Actualizar cantidad de producto en carrito
// PUT /api/v1/carrito/:id_carrito/productos/:id_producto
// Body: { cantidad: number }
// ✅ Con validación UUID
router.put('/:id_carrito/productos/:id_producto', validarUUID, actualizarCantidad);

// 🔹 Eliminar producto del carrito
// DELETE /api/v1/carrito/:id_carrito/productos/:id_producto
// ✅ Con validación UUID
router.delete('/:id_carrito/productos/:id_producto', validarUUID, eliminarProducto);

// 🔹 Vaciar carrito completo
// DELETE /api/v1/carrito/:id_carrito
// ✅ Con validación UUID
router.delete('/:id_carrito', validarUUID, vaciarCarrito);

// 🔹 Asociar carrito de sesión a un cliente (después de login/registro)
// POST /api/v1/carrito/:id_carrito/asociar-cliente
// Body: { clienteId: number }
// ✅ Con validación UUID
router.post('/:id_carrito/asociar-cliente', validarUUID, asociarClienteAlCarrito);

export default router;
