// =============================================
// 🔐 MIDDLEWARE - VALIDAR UUID
// =============================================

/**
 * Middleware para validar que id_carrito es un UUID válido
 * Uso: router.post('/carrito/:id_carrito/productos', validarUUID, agregarProducto);
 */
export const validarUUID = (req, res, next) => {
  const { id_carrito } = req.params;

  if (!id_carrito) {
    return res.status(400).json({
      status: 'error',
      message: 'id_carrito es requerido en los parámetros',
      data: null
    });
  }

  // Validar formato UUID v4
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id_carrito)) {
    return res.status(400).json({
      status: 'error',
      message: 'id_carrito debe ser un UUID válido',
      data: null,
      received: id_carrito
    });
  }

  next();
};

export default validarUUID;
