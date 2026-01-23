  // src/controllers/factura.controller.js
  // 🟢 Módulo F5: Gestión de Facturas
  import prisma from '../lib/prisma.js';

  /**
   * F5.4.1 – Consulta general de facturas
   * GET /api/v1/facturas
   */
  export const listarFacturas = async (req, res, next) => {
    try {
      const facturas = await prisma.factura.findMany({
        include: {
          cliente: true,
          iva: true,
          canal_venta: true,
          metodo_pago: true,
          empleado: {
            select: {
              id_empleado: true,
              nombre1: true,
              apellido1: true
            }
          }
        },
        orderBy: { fecha_emision: 'desc' }
      });

      return res.json({
        status: 'success',
        message: 'Facturas obtenidas correctamente',
        data: facturas
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * F5.4.2 – Consulta de facturas por parámetros (FUNCIÓN UNIVERSAL)
   * GET /api/v1/facturas/buscar
   * Query params: id, cliente, fechaDesde, fechaHasta, estado, canal, empleado
   * 
   * Ejemplos de uso:
   * - GET /api/v1/facturas/buscar?id=F-2024-000123
   * - GET /api/v1/facturas/buscar?cliente=Juan
   * - GET /api/v1/facturas/buscar?estado=APR&canal=WEB
   * - GET /api/v1/facturas/buscar?fechaDesde=2024-01-01&fechaHasta=2024-12-31
   */
  export const buscarFacturas = async (req, res, next) => {
    try {
      const { 
        id,           // ID exacto de factura
        cliente,      // Nombre, apellido o RUC del cliente
        fechaDesde, 
        fechaHasta, 
        estado,       // EMI, ANU, PAG, APR, ENT
        canal,        // WEB, POS
        empleado      // ID del empleado
      } = req.query;

      // Validar que haya al menos un criterio
      if (!id && !cliente && !fechaDesde && !fechaHasta && !estado && !canal && !empleado) {
        return res.status(400).json({
          status: 'error',
          message: 'Ingrese al menos un criterio de búsqueda',
          data: null
        });
      }

      // 🔷 CONSTRUIR FILTROS DINÁMICAMENTE
      const whereClause = {};

      // Búsqueda por ID exacto (tiene prioridad)
      if (id) {
        // Validar formato F-YYYY-NNNNNN
        const formatoFactura = /^F-\d{4}-\d{6}$/;
        if (!formatoFactura.test(id)) {
          return res.status(400).json({
            status: 'error',
            message: 'Formato de ID de factura inválido. Debe ser F-YYYY-NNNNNN',
            data: null
          });
        }
        whereClause.id_factura = id;
      }

      // Búsqueda por estado
      if (estado) {
        // Validar que el estado sea válido
        const estadosValidos = ['EMI', 'ANU', 'PAG', 'APR', 'ENT'];
        if (!estadosValidos.includes(estado.toUpperCase())) {
          return res.status(400).json({
            status: 'error',
            message: 'Estado inválido. Valores permitidos: EMI, ANU, PAG, APR, ENT',
            data: null
          });
        }
        whereClause.estado = estado.toUpperCase();
      }

      // Búsqueda por canal
      if (canal) {
        const canalUpper = canal.toUpperCase();
        const canalesValidos = ['WEB', 'POS'];
        if (!canalesValidos.includes(canalUpper)) {
          return res.status(400).json({
            status: 'error',
            message: 'Canal inválido. Valores permitidos: WEB, POS',
            data: null
          });
        }
        whereClause.id_canal = canalUpper;
      }

      // Búsqueda por empleado
      if (empleado) {
        const empleadoId = parseInt(empleado);
        if (isNaN(empleadoId)) {
          return res.status(400).json({
            status: 'error',
            message: 'ID de empleado debe ser un número válido',
            data: null
          });
        }
        whereClause.id_empleado = empleadoId;
      }

      // Búsqueda por cliente (nombre, apellido o RUC)
      if (cliente) {
        whereClause.cliente = {
          OR: [
            { nombre1: { contains: cliente, mode: 'insensitive' } },
            { nombre2: { contains: cliente, mode: 'insensitive' } },
            { apellido1: { contains: cliente, mode: 'insensitive' } },
            { apellido2: { contains: cliente, mode: 'insensitive' } },
            { ruc_cedula: { contains: cliente } }
          ]
        };
      }

      // Búsqueda por rango de fechas
      if (fechaDesde || fechaHasta) {
        whereClause.fecha_emision = {};
        
        if (fechaDesde) {
          const fechaInicio = new Date(fechaDesde);
          if (isNaN(fechaInicio.getTime())) {
            return res.status(400).json({
              status: 'error',
              message: 'Formato de fechaDesde inválido. Use YYYY-MM-DD',
              data: null
            });
          }
          fechaInicio.setHours(0, 0, 0, 0); // Inicio del día
          whereClause.fecha_emision.gte = fechaInicio;
        }
        
        if (fechaHasta) {
          const fechaFin = new Date(fechaHasta);
          if (isNaN(fechaFin.getTime())) {
            return res.status(400).json({
              status: 'error',
              message: 'Formato de fechaHasta inválido. Use YYYY-MM-DD',
              data: null
            });
          }
          fechaFin.setHours(23, 59, 59, 999); // Fin del día
          whereClause.fecha_emision.lte = fechaFin;
        }
      }

      // 🔷 EJECUTAR BÚSQUEDA
      const facturas = await prisma.factura.findMany({
        where: whereClause,
        include: {
          cliente: {
            select: {
              id_cliente: true,
              nombre1: true,
              nombre2: true,
              apellido1: true,
              apellido2: true,
              ruc_cedula: true,
              email: true,
              telefono: true
            }
          },
          detalle_factura: {
            include: { 
              producto: {
                select: {
                  id_producto: true,
                  descripcion: true,
                  precio_venta: true,
                  marca: {
                    select: {
                      nombre: true
                    }
                  }
                }
              }
            }
          },
          iva: true,
          canal_venta: true,
          metodo_pago: true,
          empleado: {
            select: {
              id_empleado: true,
              nombre1: true,
              apellido1: true
            }
          }
        },
        orderBy: { fecha_emision: 'desc' }
      });

      // Si no hay resultados
      if (facturas.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'No se encontraron facturas con los criterios especificados',
          data: []
        });
      }

      // Formatear respuesta
      const facturasFormateadas = facturas.map(factura => ({
        id_factura: factura.id_factura,
        fecha_emision: factura.fecha_emision,
        cliente: {
          id_cliente: factura.cliente.id_cliente,
          nombre_completo: [
            factura.cliente.nombre1,
            factura.cliente.nombre2,
            factura.cliente.apellido1,
            factura.cliente.apellido2
          ].filter(Boolean).join(' '),
          ruc_cedula: factura.cliente.ruc_cedula,
          email: factura.cliente.email,
          telefono: factura.cliente.telefono
        },
        empleado: factura.empleado ? {
          id_empleado: factura.empleado.id_empleado,
          nombre_completo: [
            factura.empleado.nombre1,
            factura.empleado.apellido1
          ].filter(Boolean).join(' ')
        } : null,
        canal: factura.canal_venta.descripcion,
        metodo_pago: factura.metodo_pago.nombre,
        estado: factura.estado,
        estado_texto: {
          'EMI': 'Emitida',
          'ANU': 'Anulada',
          'PAG': 'Pagada',
          'APR': 'Aprobada',
          'ENT': 'Entregada'
        }[factura.estado] || factura.estado,
        subtotal: parseFloat(factura.subtotal),
        total: parseFloat(factura.total),
        iva_porcentaje: parseFloat(factura.iva.porcentaje),
        cantidad_items: factura.detalle_factura.length,
        productos: factura.detalle_factura.map(d => ({
          id_producto: d.id_producto,
          descripcion: d.producto.descripcion,
          marca: d.producto.marca?.nombre,
          cantidad: d.cantidad,
          precio_unitario: parseFloat(d.precio_unitario),
          subtotal: parseFloat(d.subtotal)
        }))
      }));

      return res.json({
        status: 'success',
        message: 'Búsqueda completada',
        data: facturasFormateadas,
        total_resultados: facturasFormateadas.length,
        criterios_aplicados: {
          id: id || null,
          cliente: cliente || null,
          fechaDesde: fechaDesde || null,
          fechaHasta: fechaHasta || null,
          estado: estado || null,
          canal: canal || null,
          empleado: empleado || null
        }
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * F5.1 – Crear factura desde carrito (Checkout)
   * POST /api/v1/facturas
   * Body: { id_cliente, id_carrito, id_metodo_pago, id_iva }
   * 
   * REFACTORIZADO: Usa fn_ingresar_factura() de la BD
   * Parámetros BD: p_id_canal, p_id_cliente, p_id_metodo_pago, p_id_iva, p_detalle_productos, p_id_carrito, p_id_empleado, p_id_usuario
   */
  export const crearFactura = async (req, res, next) => {
    try {
      const { id_cliente, id_carrito, id_metodo_pago, id_iva, cedula, items } = req.body;
      const id_empleado = req.usuario?.id_empleado || null;
      const id_usuario = req.usuario?.id_usuario || null;

      // 🔷 MODO POS: Sin carrito, con cédula + items directos
      if (cedula && items && items.length > 0) {
        return await crearFacturaPOS({ cedula, items, id_iva, id_empleado, id_usuario }, res, next);
      }

      // 🔷 MODO E-COMMERCE: Con carrito
      // Validación de parámetros requeridos
      if (!id_cliente || !id_carrito || !id_metodo_pago || !id_iva) {
        return res.status(400).json({
          status: 'error',
          message: 'Parámetros requeridos: id_cliente, id_carrito, id_metodo_pago, id_iva',
          data: null
        });
      }

      // Determinar canal de venta
      const id_canal = id_empleado ? 'POS' : 'WEB';

      // Obtener productos del carrito para construir JSONB
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

      if (carrito.carrito_detalle.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'El carrito está vacío',
          data: null
        });
      }

      // Construir JSONB de productos para la función de BD
      const detalle_productos = carrito.carrito_detalle.map(detalle => ({
        id_producto: detalle.id_producto,
        cantidad: detalle.cantidad
      }));

      const detalle_productos_json = JSON.stringify(detalle_productos);

      // 🔷 LLAMAR FUNCIÓN DE BD: fn_ingresar_factura() con parámetros en ORDEN CORRECTO
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
          message: 'Error al crear factura',
          data: null
        });
      }

      const factura = resultado[0];

      // Validar si BD retornó error
      if (!factura.resultado || factura.mensaje?.includes('ERROR')) {
        return res.status(400).json({
          status: 'error',
          message: factura.mensaje || 'Error al crear factura',
          data: null
        });
      }

      return res.status(201).json({
        status: 'success',
        message: 'Factura creada correctamente',
        data: {
          id_factura: factura.id_factura_generada,
          mensaje: factura.mensaje
        }
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * 🆕 CREAR FACTURA POS (sin carrito)
   * Utilizado internamente por crearFactura cuando se envían items directos
   * Body: { cedula, items: [{ id_producto, cantidad, precio_unitario, subtotal }], id_iva }
   */
  async function crearFacturaPOS({ cedula, items, id_iva, id_empleado, id_usuario }, res, next) {
    try {
      // 1. Buscar cliente por cédula
      const cliente = await prisma.cliente.findUnique({
        where: { ruc_cedula: cedula.trim() }
      });

      if (!cliente) {
        return res.status(404).json({
          status: 'error',
          message: 'Cliente no encontrado',
          data: null
        });
      }

      // 2. Validar IVA
      const iva = await prisma.iva.findUnique({
        where: { id_iva: Number(id_iva) }
      });

      if (!iva) {
        return res.status(404).json({
          status: 'error',
          message: 'IVA no encontrado',
          data: null
        });
      }

      // 3. Validar productos y calcular totales
      let subtotal = 0;
      const detallesValidados = [];

      for (const item of items) {
        const producto = await prisma.producto.findUnique({
          where: { id_producto: item.id_producto }
        });

        if (!producto) {
          return res.status(404).json({
            status: 'error',
            message: `Producto ${item.id_producto} no encontrado`,
            data: null
          });
        }

        if (producto.stock < item.cantidad) {
          return res.status(400).json({
            status: 'error',
            message: `Stock insuficiente para ${producto.descripcion}. Disponible: ${producto.stock}`,
            data: null
          });
        }

        const precio = Number(item.precio_unitario || producto.precio_venta);
        const cantidad = Number(item.cantidad);
        const itemSubtotal = precio * cantidad;
        subtotal += itemSubtotal;

        detallesValidados.push({
          id_producto: item.id_producto,
          cantidad,
          precio_unitario: parseFloat(precio.toFixed(3)),
          subtotal: parseFloat(itemSubtotal.toFixed(3))
        });
      }

      // 4. Calcular IVA y total
      const porcentajeIva = Number(iva.porcentaje);
      const valorIva = parseFloat((subtotal * porcentajeIva / 100).toFixed(3));
      const total = parseFloat((subtotal + valorIva).toFixed(3));

      // 5. Generar ID de factura
      const año = new Date().getFullYear();
      const ultimaFactura = await prisma.factura.findFirst({
        where: {
          id_factura: {
            startsWith: `F-${año}-`
          }
        },
        orderBy: {
          id_factura: 'desc'
        }
      });

      let numeroSecuencial = 1;
      if (ultimaFactura) {
        const partes = ultimaFactura.id_factura.split('-');
        numeroSecuencial = parseInt(partes[2]) + 1;
      }

      const id_factura = `F-${año}-${String(numeroSecuencial).padStart(6, '0')}`;

      // 6. Crear factura en transacción
      const resultado = await prisma.$transaction(async (tx) => {
        // Crear factura
        const nuevaFactura = await tx.factura.create({
          data: {
            id_factura,
            id_cliente: cliente.id_cliente,
            id_canal: 'POS',
            id_metodo_pago: 1, // EFECTIVO por defecto en POS
            id_iva: Number(id_iva),
            id_empleado: id_empleado,
            fecha_emision: new Date(),
            subtotal: parseFloat(subtotal.toFixed(3)),
            total,
            estado: 'EMI'
          }
        });

        // Crear detalles
        for (const detalle of detallesValidados) {
          await tx.detalle_factura.create({
            data: {
              id_factura: nuevaFactura.id_factura,
              id_producto: detalle.id_producto,
              cantidad: detalle.cantidad,
              precio_unitario: detalle.precio_unitario,
              subtotal: detalle.subtotal,
              estado: 'ACT'
            }
          });

          // Actualizar stock
          await tx.producto.update({
            where: { id_producto: detalle.id_producto },
            data: {
              stock: {
                decrement: detalle.cantidad
              }
            }
          });
        }

        return nuevaFactura;
      });

      return res.status(201).json({
        status: 'success',
        message: 'Factura creada correctamente',
        data: {
          id_factura: resultado.id_factura,
          subtotal: resultado.subtotal,
          total: resultado.total
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * F5.2 – Anular factura
   * POST /api/v1/facturas/:id/anular
   * Body: { motivo_anulacion?: string }
   * 
   * REFACTORIZADO: Usa fn_anular_factura() de la BD
   * Parámetros BD: p_id_factura, p_motivo_anulacion, p_id_usuario
   */
  export const anularFactura = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { motivo_anulacion } = req.body;
      const id_usuario = req.usuario?.id_usuario || null;

      if (!id) {
        return res.status(400).json({
          status: 'error',
          message: 'ID de factura es requerido',
          data: null
        });
      }

      // Validar formato de factura F-YYYY-NNNNNN
      const formatoFactura = /^F-\d{4}-\d{6}$/;
      if (!formatoFactura.test(id)) {
        return res.status(400).json({
          status: 'error',
          message: 'Formato de ID de factura inválido. Debe ser F-YYYY-NNNNNN',
          data: null
        });
      }

      // 🔷 LLAMAR FUNCIÓN DE BD: fn_anular_factura() con TODOS los parámetros
      const resultado = await prisma.$queryRaw`
        SELECT * FROM fn_anular_factura(
          ${id}::VARCHAR(15),
          ${motivo_anulacion || null}::TEXT,
          ${id_usuario}::INTEGER
        )
      `;

      if (!resultado || resultado.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Error al anular factura',
          data: null
        });
      }

      const anulacion = resultado[0];

      // Validar si BD retornó error
      if (!anulacion.resultado || anulacion.mensaje?.includes('ERROR')) {
        return res.status(400).json({
          status: 'error',
          message: anulacion.mensaje || 'Error al anular factura',
          data: null
        });
      }

      return res.json({
        status: 'success',
        message: 'Factura anulada correctamente',
        data: {
          id_factura: id,
          mensaje: anulacion.mensaje
        }
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * F5.5 – Datos para impresión de factura
   * GET /api/v1/facturas/:id/imprimir
   */
  export const imprimirFactura = async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: 'error',
          message: 'ID de factura es requerido',
          data: null
        });
      }

      const factura = await prisma.factura.findUnique({
        where: { id_factura: id },
        include: {
          cliente: {
            include: { ciudad: true }
          },
          detalle_factura: {
            include: { producto: true }
          },
          iva: true,
          empleado: true,
          metodo_pago: true,
          canal_venta: true
        }
      });

      if (!factura) {
        return res.status(404).json({
          status: 'error',
          message: 'La factura no existe',
          data: null
        });
      }

      const subtotalNum = parseFloat(factura.subtotal);
      const totalNum = parseFloat(factura.total);
      const valorIva = totalNum - subtotalNum;

      const datosImpresion = {
        // Encabezado
        numero_factura: factura.id_factura,
        fecha_emision: factura.fecha_emision,
        estado: factura.estado,
        estado_texto: {
          'EMI': 'EMITIDA',
          'ANU': 'ANULADA',
          'PAG': 'PAGADA'
        }[factura.estado] || factura.estado,
        canal: factura.canal_venta.descripcion,

        // Cliente
        cliente: {
          identificacion: factura.cliente.ruc_cedula,
          nombre_completo: [
            factura.cliente.nombre1,
            factura.cliente.nombre2,
            factura.cliente.apellido1,
            factura.cliente.apellido2
          ].filter(Boolean).join(' '),
          direccion: factura.cliente.direccion,
          telefono: factura.cliente.telefono,
          email: factura.cliente.email,
          ciudad: factura.cliente.ciudad?.descripcion
        },

        // Empleado (si aplica)
        empleado: factura.empleado ? {
          nombre_completo: [
            factura.empleado.nombre1,
            factura.empleado.apellido1
          ].filter(Boolean).join(' ')
        } : null,

        // Método de pago
        metodo_pago: factura.metodo_pago.nombre,

        // Detalles
        detalles: factura.detalle_factura.map((d, idx) => ({
          linea: idx + 1,
          codigo: d.id_producto,
          descripcion: d.producto.descripcion,
          cantidad: d.cantidad,
          precio_unitario: parseFloat(d.precio_unitario),
          subtotal: parseFloat(d.subtotal)
        })),

        // Totales
        subtotal: subtotalNum,
        porcentaje_iva: parseFloat(factura.iva.porcentaje),
        valor_iva: parseFloat(valorIva.toFixed(3)),
        total: totalNum,

        // Marca de agua si está anulada
        marca_agua: factura.estado === 'ANU' ? 'ANULADA' : null
      };

      return res.json({
        status: 'success',
        message: 'Datos de impresión obtenidos',
        data: datosImpresion
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/facturas/cliente/:id_cliente
   * Obtener facturas de un cliente específico
   */
  export const facturasCliente = async (req, res, next) => {
    try {
      const { id_cliente } = req.params;

      const facturas = await prisma.factura.findMany({
        where: { id_cliente: Number(id_cliente) },
        include: {
          detalle_factura: {
            include: { producto: true }
          },
          metodo_pago: true,
          canal_venta: true
        },
        orderBy: { fecha_emision: 'desc' }
      });

      return res.json({
        status: 'success',
        message: 'Facturas del cliente obtenidas',
        data: facturas
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/facturas/mis-pedidos
   * Obtener historial de pedidos del cliente autenticado
   * Requiere autenticación - el id_cliente viene del token JWT
   */
  export const misPedidos = async (req, res, next) => {
    try {
      const id_cliente = req.usuario?.id_cliente;

      if (!id_cliente) {
        return res.status(403).json({
          status: 'error',
          message: 'No tiene permisos para acceder a este recurso',
          data: null
        });
      }

      const facturas = await prisma.factura.findMany({
        where: { 
          id_cliente: id_cliente,
          id_canal: 'WEB' // Solo pedidos del e-commerce
        },
        include: {
          detalle_factura: {
            include: { 
              producto: {
                select: {
                  id_producto: true,
                  descripcion: true,
                  imagen_url: true,
                  marca: {
                    select: {
                      nombre: true
                    }
                  }
                }
              }
            }
          },
          metodo_pago: {
            select: {
              nombre: true
            }
          },
          canal_venta: {
            select: {
              descripcion: true
            }
          }
        },
        orderBy: { fecha_emision: 'desc' }
      });

      // Formatear respuesta para mejor UX en frontend
      const pedidosFormateados = facturas.map(factura => ({
        id_factura: factura.id_factura,
        fecha_emision: factura.fecha_emision,
        subtotal: parseFloat(factura.subtotal),
        total: parseFloat(factura.total),
        estado: factura.estado,
        estado_texto: {
          'EMI': 'Emitida',
          'ANU': 'Anulada',
          'PAG': 'Pagada',
          'APR': 'Aprobada',
          'ENT': 'Entregada'
        }[factura.estado] || factura.estado,
        puede_anular: factura.estado === 'EMI', // Solo emitidas se pueden anular
        metodo_pago: factura.metodo_pago.nombre,
        canal: factura.canal_venta?.descripcion,
        productos: factura.detalle_factura.map(d => ({
          id_producto: d.id_producto,
          descripcion: d.producto.descripcion,
          marca: d.producto.marca?.nombre,
          imagen_url: d.producto.imagen_url,
          cantidad: d.cantidad,
          precio_unitario: parseFloat(d.precio_unitario),
          subtotal: parseFloat(d.subtotal)
        })),
        cantidad_items: factura.detalle_factura.length
      }));

      return res.json({
        status: 'success',
        message: 'Historial de pedidos obtenido',
        data: pedidosFormateados,
        total_pedidos: pedidosFormateados.length
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/facturas/pedidos-retiro?id_sucursal=1
   * Listar pedidos pendientes de retiro del e-commerce
   * Para uso en POS - permite al cajero ver pedidos a retirar
   */
  export const pedidosPendientesRetiro = async (req, res, next) => {
    try {
      const id_empleado = req.usuario?.id_empleado;

      if (!id_empleado) {
        return res.status(403).json({
          status: 'error',
          message: 'Debe estar autenticado como empleado',
          data: null
        });
      }

      // Buscar facturas de e-commerce pendientes de retiro
      // Estado 'APR' = Aprobada (según fn_ingresar_factura)
      const pedidos = await prisma.factura.findMany({
        where: {
          id_canal: 'WEB',
          estado: 'APR', // Aprobadas, pendientes de entrega
          fecha_retiro: null // Aún no retiradas
        },
        include: {
          cliente: {
            select: {
              id_cliente: true,
              nombre1: true,
              nombre2: true,
              apellido1: true,
              apellido2: true,
              ruc_cedula: true,
              telefono: true
            }
          },
          detalle_factura: {
            include: {
              producto: {
                select: {
                  id_producto: true,
                  descripcion: true,
                  marca: {
                    select: { nombre: true }
                  }
                }
              }
            }
          },
          metodo_pago: {
            select: { nombre: true }
          }
        },
        orderBy: { fecha_emision: 'asc' } // Más antiguos primero
      });

      // Formatear para mejor UX en POS
      const pedidosFormateados = pedidos.map(pedido => ({
        id_factura: pedido.id_factura,
        fecha_emision: pedido.fecha_emision,
        cliente: {
          id_cliente: pedido.cliente.id_cliente,
          nombre_completo: [
            pedido.cliente.nombre1,
            pedido.cliente.nombre2,
            pedido.cliente.apellido1,
            pedido.cliente.apellido2
          ].filter(Boolean).join(' '),
          ruc_cedula: pedido.cliente.ruc_cedula,
          telefono: pedido.cliente.telefono
        },
        total: parseFloat(pedido.total),
        metodo_pago: pedido.metodo_pago.nombre,
        cantidad_items: pedido.detalle_factura.length,
        productos: pedido.detalle_factura.map(d => ({
          descripcion: d.producto.descripcion,
          marca: d.producto.marca?.nombre,
          cantidad: d.cantidad
        }))
      }));

      return res.json({
        status: 'success',
        message: 'Pedidos pendientes de retiro',
        data: pedidosFormateados,
        total_pendientes: pedidosFormateados.length
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/facturas/:id/marcar-retirado
   * Marcar un pedido como retirado
   * Actualiza fecha_retiro y opcionalmente cambia estado
   */
  export const marcarRetirado = async (req, res, next) => {
    try {
      const { id } = req.params;

      const factura = await prisma.factura.findUnique({
        where: { id_factura: id }
      });

      if (!factura) {
        return res.status(404).json({
          status: 'error',
          message: 'Factura no encontrada',
          data: null
        });
      }

      if (factura.id_canal !== 'WEB') {
        return res.status(400).json({
          status: 'error',
          message: 'Solo se pueden marcar como retirados los pedidos del e-commerce',
          data: null
        });
      }

      if (factura.fecha_retiro) {
        return res.status(400).json({
          status: 'error',
          message: 'Este pedido ya fue retirado',
          data: { fecha_retiro: factura.fecha_retiro }
        });
      }

      const facturaActualizada = await prisma.factura.update({
        where: { id_factura: id },
        data: {
          fecha_retiro: new Date()
        }
      });

      return res.json({
        status: 'success',
        message: 'Pedido marcado como retirado',
        data: {
          id_factura: facturaActualizada.id_factura,
          fecha_retiro: facturaActualizada.fecha_retiro
        }
      });
    } catch (err) {
      next(err);
    }
  };

  export default {
    listarFacturas,
    buscarFacturas,
    crearFactura,
    anularFactura,
    imprimirFactura,
    facturasCliente,
    misPedidos,
    pedidosPendientesRetiro,
    marcarRetirado
  };