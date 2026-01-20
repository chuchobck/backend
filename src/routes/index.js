// src/routes/index.js - Agregador de todas las rutas

import { Router } from 'express';

// ========== RUTAS CORE ==========
import authRoutes from './auth.routes.js';
import proveedorRoutes from './proveedor.routes.js';
import compraRoutes from './compra.routes.js';
import bodegaRoutes from './bodega.routes.js';
import clienteRoutes from './cliente.routes.js';
import facturaRoutes from './factura.routes.js';
import productoRoutes from './producto.routes.js';

// ========== RUTAS E-COMMERCE ==========
import catalogoRoutes from './catalogo.routes.js';
import promocionRoutes from './promocion.routes.js';
import carritoRoutes from './carrito.routes.js';
import favoritoRoutes from './favorito.routes.js';

// ========== RUTAS AUXILIARES  ==========
import ciudadRoutes from './ciudad.routes.js';
import categoriaProductoRoutes from './categoriaProducto.routes.js';
import unidadMedidaRoutes from './unidadMedida.routes.js';
import ivaRoutes from './iva.routes.js';
import rolRoutes from './rol.routes.js';
import marcaRoutes from './marca.routes.js';
import canalVentaRoutes from './canal-venta.routes.js';
import metodoPagoRoutes from './metodo-pago.routes.js';
import categoriaPromocionRoutes from './categoria-promocion.routes.js';
import sucursalRoutes from './sucursal.routes.js';
import empleadoRoutes from './empleado.routes.js';
import ajusteInventarioRoutes from './ajusteInventario.routes.js';
import auditoriaRoutes from './auditoria.routes.js';

const router = Router();

// ===================================
// RUTAS PÚBLICAS
// ===================================
router.use('/auth', authRoutes);

// ===================================
// MÓDULOS PRINCIPALES
// ===================================

// F1: Proveedores (Solo Admin)
router.use('/proveedores', proveedorRoutes);

// F2: Órdenes de Compra (Solo Admin)
router.use('/compras', compraRoutes);

// F3: Bodega - Recepciones (Solo Admin)q
router.use('/bodega', bodegaRoutes);

// F4: Clientes (Admin, Cliente, POS)
router.use('/clientes', clienteRoutes);

// F5: Facturas (Todos según permisos)
router.use('/facturas', facturaRoutes);

// F6: Productos (Todos según permisos)
router.use('/productos', productoRoutes);

// ===================================
// E-COMMERCE (RUTAS PÚBLICAS)
// ===================================
router.use('/catalogo', catalogoRoutes);
router.use('/promociones', promocionRoutes);

// ===================================
// AUXILIARES 
// ===================================

router.use('/ciudades', ciudadRoutes);
router.use('/categorias', categoriaProductoRoutes);
router.use('/unidades-medida', unidadMedidaRoutes);
router.use('/iva', ivaRoutes);
router.use('/roles', rolRoutes);
router.use('/marcas', marcaRoutes);
router.use('/canales-venta', canalVentaRoutes);
router.use('/metodos-pago', metodoPagoRoutes);
router.use('/categorias-promocion', categoriaPromocionRoutes);
router.use('/sucursales', sucursalRoutes);
router.use('/empleados', empleadoRoutes);
router.use('/ajustes-inventario', ajusteInventarioRoutes);
router.use('/auditorias', auditoriaRoutes);
router.use('/carrito', carritoRoutes);
router.use('/favoritos', favoritoRoutes);

export default router;
