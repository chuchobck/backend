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
} from '../controllers/carrito.controller.js';

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
router.post('/:id_carrito/productos', agregarProducto);

// 🔹 Actualizar cantidad de producto en carrito
// PUT /api/v1/carrito/:id_carrito/productos/:id_producto
// Body: { cantidad: number }
router.put('/:id_carrito/productos/:id_producto', actualizarCantidad);

// 🔹 Eliminar producto del carrito
// DELETE /api/v1/carrito/:id_carrito/productos/:id_producto
router.delete('/:id_carrito/productos/:id_producto', eliminarProducto);

// 🔹 Vaciar carrito completo
// DELETE /api/v1/carrito/:id_carrito
router.delete('/:id_carrito', vaciarCarrito);

// 🔹 Asociar carrito de sesión a un cliente (después de login/registro)
// POST /api/v1/carrito/:id_carrito/asociar-cliente
// Body: { clienteId: number }
router.post('/:id_carrito/asociar-cliente', asociarClienteAlCarrito);

export default router;
