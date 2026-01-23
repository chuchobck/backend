// src/controllers/favorito.controller.js
import prisma from '../lib/prisma.js';

/**
 * Listar favoritos de un cliente
 * GET /api/v1/favoritos?clienteId=123
 */
export const listarFavoritos = async (req, res, next) => {
  try {
    const clienteId = parseInt(req.query.clienteId);
    
    if (!clienteId || isNaN(clienteId)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'clienteId requerido y debe ser un número válido', 
        data: null 
      });
    }

    // Verificar que el cliente existe
    const clienteExiste = await prisma.cliente.findUnique({
      where: { id_cliente: clienteId }
    });

    if (!clienteExiste) {
      return res.status(404).json({
        status: 'error',
        message: 'Cliente no encontrado',
        data: null
      });
    }

    const favoritos = await prisma.producto_favorito.findMany({
      where: { id_cliente: clienteId },
      include: { 
        producto: {
          include: {
            marca: {
              select: {
                id_marca: true,
                nombre: true,
                imagen_url: true
              }
            },
            categoria_producto: {
              select: {
                id_prod_categoria: true,
                nombre: true,
                descripcion: true
              }
            }
          }
        }
      },
      orderBy: { fecha_creacion: 'desc' }
    });

    res.json({ 
      status: 'success', 
      message: `${favoritos.length} favoritos encontrados`, 
      data: favoritos 
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Agregar producto a favoritos
 * POST /api/v1/favoritos
 * Body: { clienteId: 1, productoId: "P000001" }
 */
export const agregarFavorito = async (req, res, next) => {
  try {
    const { clienteId, productoId } = req.body;
    
    if (!clienteId || !productoId) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'clienteId y productoId son requeridos', 
        data: null 
      });
    }

    // Validar que el cliente existe
    const clienteExiste = await prisma.cliente.findUnique({
      where: { id_cliente: parseInt(clienteId) }
    });

    if (!clienteExiste) {
      return res.status(404).json({
        status: 'error',
        message: 'Cliente no encontrado',
        data: null
      });
    }

    // Validar que el producto existe y está activo
    const productoExiste = await prisma.producto.findFirst({
      where: { 
        id_producto: productoId,
        estado: 'ACT'
      }
    });

    if (!productoExiste) {
      return res.status(404).json({
        status: 'error',
        message: 'Producto no encontrado o no disponible',
        data: null
      });
    }

    // Verificar si ya existe en favoritos
    const existente = await prisma.producto_favorito.findUnique({
      where: { 
        id_cliente_id_producto: {
          id_cliente: parseInt(clienteId),
          id_producto: productoId
        }
      }
    });

    if (existente) {
      return res.status(409).json({ 
        status: 'error', 
        message: 'Producto ya está en favoritos', 
        data: existente 
      });
    }

    // Crear favorito
    const favorito = await prisma.producto_favorito.create({
      data: { 
        id_cliente: parseInt(clienteId), 
        id_producto: productoId 
      },
      include: {
        producto: {
          include: {
            marca: true,
            categoria_producto: true
          }
        }
      }
    });

    res.status(201).json({ 
      status: 'success', 
      message: 'Producto agregado a favoritos', 
      data: favorito 
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Eliminar favorito (eliminación física)
 * DELETE /api/v1/favoritos/:productoId?clienteId=123
 */
export const eliminarFavorito = async (req, res, next) => {
  try {
    const { productoId } = req.params;
    const clienteId = parseInt(req.query.clienteId);

    if (!clienteId || isNaN(clienteId)) {
      return res.status(400).json({
        status: 'error',
        message: 'clienteId requerido como query parameter',
        data: null
      });
    }

    if (!productoId) {
      return res.status(400).json({
        status: 'error',
        message: 'productoId requerido en la URL',
        data: null
      });
    }

    // Verificar que existe el favorito
    const favorito = await prisma.producto_favorito.findUnique({
      where: { 
        id_cliente_id_producto: { 
          id_cliente: clienteId,
          id_producto: productoId
        }
      }
    });

    if (!favorito) {
      return res.status(404).json({
        status: 'error',
        message: 'Producto no encontrado en favoritos',
        data: null
      });
    }

    // ✅ ELIMINACIÓN FÍSICA (no hay campo estado)
    await prisma.producto_favorito.delete({
      where: { 
        id_cliente_id_producto: { 
          id_cliente: clienteId,
          id_producto: productoId
        }
      }
    });

    res.json({ 
      status: 'success', 
      message: 'Producto eliminado de favoritos', 
      data: null 
    });
  } catch (err) {
    next(err);
  }
};

export default {
  listarFavoritos,
  agregarFavorito,
  eliminarFavorito
};
