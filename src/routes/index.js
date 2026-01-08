// src/routes/index.js - Agregador de todas las rutas

import { Router } from 'express';

// ========== RUTAS CORE ==========
import authRoutes from './auth.routes.js';
import proveedoresRoutes from './proveedores.routes.js';
import comprasRoutes from './compras.routes.js';
import bodegaRoutes from './bodega.routes.js';
import clientesRoutes from './clientes.routes.js';
import facturasRoutes from './facturas.routes.js';
import productosRoutes from './productos.routes.js';

// ========== RUTAS E-COMMERCE ==========
import catalogoRoutes from './catalogo.routes.js';
import promocionesRoutes from './promociones.routes.js';
import carritoRoutes from './carrito.routes.js';
import pedidoRoutes from './pedido.routes.js'; 
import pagoRoutes from './pago.routes.js';
import favoritosRoutes from './favoritos.routes.js';

// ========== RUTAS AUXILIARES  ==========
import ciudadRoutes from './ciudad.routes.js';
import categoriaProductoRoutes from './categoriaProducto.routes.js';
import unidadMedidaRoutes from './unidadMedida.routes.js';
import ivaRoutes from './iva.routes.js';
import rolRoutes from './rol.routes.js';
import marcaRoutes from './marca.routes.js';

const router = Router();

// ===================================
// RUTAS PÚBLICAS
// ===================================
router.use('/auth', authRoutes);

// ===================================
// MÓDULOS PRINCIPALES
// ===================================

// F1: Proveedores (Solo Admin)
router.use('/proveedores', proveedoresRoutes);

// F2: Órdenes de Compra (Solo Admin)
router.use('/compras', comprasRoutes);

// F3: Bodega - Recepciones (Solo Admin)q
router.use('/bodega', bodegaRoutes);

// F4: Clientes (Admin, Cliente, POS)
router.use('/clientes', clientesRoutes);

// F5: Facturas (Todos según permisos)
router.use('/facturas', facturasRoutes);

// F6: Productos (Todos según permisos)
router.use('/productos', productosRoutes);

// ===================================
// E-COMMERCE (RUTAS PÚBLICAS)
// ===================================
router.use('/catalogo', catalogoRoutes);
router.use('/promociones', promocionesRoutes);

// ===================================
// AUXILIARES 
// ===================================

router.use('/ciudades', ciudadRoutes);
router.use('/categorias', categoriaProductoRoutes);
router.use('/unidades-medida', unidadMedidaRoutes);
router.use('/iva', ivaRoutes);
router.use('/roles', rolRoutes);
router.use('/marcas', marcaRoutes);
router.use('/carrito', carritoRoutes);
router.use('/pedidos', pedidoRoutes);
router.use('/pagos', pagoRoutes);
router.use('/favoritos', favoritosRoutes);

export default router;
