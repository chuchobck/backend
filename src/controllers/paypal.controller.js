// src/controllers/paypal.controller.js
// Integración con PayPal para pagos en e-commerce

import { getPayPalAccessToken, paypalConfig } from '../config/paypal.js';
import prisma from '../lib/prisma.js';

/**
 * POST /api/v1/paypal/crear-orden
 * Crear orden de pago en PayPal antes de redirigir al usuario
 * Body: { id_carrito, total, items }
 */
export const crearOrdenPayPal = async (req, res, next) => {
  try {
    const { id_carrito, total } = req.body;
    const id_cliente = req.usuario?.id_cliente;
    const id_usuario = req.usuario?.id;

    // Validaciones
    if (!id_carrito || !total) {
      return res.status(400).json({
        status: 'error',
        message: 'Parámetros requeridos: id_carrito, total',
        data: null
      });
    }

    if (!id_cliente) {
      return res.status(400).json({
        status: 'error',
        message: 'Usuario no autorizado como cliente',
        data: null
      });
    }

    // Verificar que el carrito existe y está activo
    const carrito = await prisma.carrito.findUnique({
      where: { id_carrito },
      include: {
        carrito_detalle: {
          include: { producto: true }
        }
      }
    });

    if (!carrito || carrito.estado !== 'ACT') {
      return res.status(404).json({
        status: 'error',
        message: 'Carrito no encontrado o inactivo',
        data: null
      });
    }

    if (carrito.carrito_detalle.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'El carrito está vacío',
        data: null
      });
    }

    // Obtener token de PayPal
    const accessToken = await getPayPalAccessToken();

    // Construir descripción de items para PayPal
    const itemsDescription = carrito.carrito_detalle
      .map(d => `${d.producto.descripcion} x${d.cantidad}`)
      .join(', ');

    // Crear orden en PayPal
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: id_carrito,
        description: `Carrito ${id_carrito.substring(0, 8)}`,
        amount: {
          currency_code: 'USD',
          value: parseFloat(total).toFixed(2),
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: parseFloat(total).toFixed(2)
            }
          }
        }
      }],
      application_context: {
        brand_name: 'Barbox Store',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/pago-exitoso`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/checkout`
      }
    };

    const response = await fetch(`${paypalConfig.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    const order = await response.json();

    if (!response.ok) {
      console.error('Error de PayPal:', order);
      return res.status(500).json({
        status: 'error',
        message: 'Error al crear orden en PayPal',
        data: order
      });
    }

    // Guardar orden pendiente en localStorage del cliente (no en BD aún)
    // La factura se creará solo cuando se confirme el pago

    res.json({
      status: 'success',
      message: 'Orden de PayPal creada exitosamente',
      data: {
        order_id: order.id,
        approve_url: order.links.find(link => link.rel === 'approve')?.href,
        carrito_id: id_carrito
      }
    });
  } catch (err) {
    console.error('Error en crearOrdenPayPal:', err);
    next(err);
  }
};

/**
 * POST /api/v1/paypal/confirmar
 * Confirmar pago de PayPal y crear factura
 * Body: { order_id, id_carrito, id_metodo_pago, id_iva }
 */
export const confirmarPagoPayPal = async (req, res, next) => {
  try {
    const { order_id, id_carrito, id_metodo_pago, id_iva } = req.body;
    const id_cliente = req.usuario?.id_cliente;
    const id_empleado = req.usuario?.id_empleado || null;
    const id_usuario = req.usuario?.id;

    // Validaciones
    if (!order_id || !id_carrito || !id_metodo_pago || !id_iva) {
      return res.status(400).json({
        status: 'error',
        message: 'Parámetros requeridos: order_id, id_carrito, id_metodo_pago, id_iva',
        data: null
      });
    }

    if (!id_cliente) {
      return res.status(400).json({
        status: 'error',
        message: 'Usuario no autorizado como cliente',
        data: null
      });
    }

    // Obtener token de PayPal
    const accessToken = await getPayPalAccessToken();

    // Capturar pago en PayPal
    const captureResponse = await fetch(
      `${paypalConfig.baseUrl}/v2/checkout/orders/${order_id}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const captureData = await captureResponse.json();

    if (!captureResponse.ok || captureData.status !== 'COMPLETED') {
      console.error('Error capturando pago PayPal:', captureData);
      return res.status(400).json({
        status: 'error',
        message: 'El pago no pudo ser capturado en PayPal',
        data: captureData
      });
    }

    // Obtener carrito con detalles
    const carrito = await prisma.carrito.findUnique({
      where: { id_carrito },
      include: {
        carrito_detalle: {
          include: { producto: true }
        }
      }
    });

    if (!carrito) {
      return res.status(404).json({
        status: 'error',
        message: 'Carrito no encontrado',
        data: null
      });
    }

    // Construir JSONB de productos
    const detalle_productos = carrito.carrito_detalle.map(detalle => ({
      id_producto: detalle.id_producto,
      cantidad: detalle.cantidad
    }));

    const detalle_productos_json = JSON.stringify(detalle_productos);

    // Determinar canal automáticamente
    const id_canal = id_empleado ? 'POS' : 'WEB';

    // 🔷 CREAR FACTURA usando stored procedure
    const resultado = await prisma.$queryRaw`
      SELECT * FROM fn_ingresar_factura(
        ${id_canal}::CHAR(3),
        ${Number(id_cliente)}::INTEGER,
        ${Number(id_metodo_pago)}::INTEGER,
        ${Number(id_iva)}::INTEGER,
        ${detalle_productos_json}::JSONB,
        ${id_carrito}::UUID,
        ${id_empleado}::INTEGER,
        ${id_usuario}::INTEGER
      )
    `;

    if (!resultado || resultado.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Error al crear factura después de pago',
        data: null
      });
    }

    const factura = resultado[0];

    if (!factura.resultado || factura.mensaje?.includes('ERROR')) {
      return res.status(400).json({
        status: 'error',
        message: factura.mensaje || 'Error al crear factura',
        data: null
      });
    }

    // Retornar éxito con datos de factura
    return res.status(201).json({
      status: 'success',
      message: 'Pago confirmado y factura creada correctamente',
      data: {
        id_factura: factura.id_factura_generada,
        paypal_order_id: order_id,
        paypal_status: captureData.status,
        mensaje: factura.mensaje
      }
    });
  } catch (err) {
    console.error('Error en confirmarPagoPayPal:', err);
    next(err);
  }
};
