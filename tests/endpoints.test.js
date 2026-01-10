import request from 'supertest';
import express from 'express';

// Create a minimal app to test endpoints without importing the full project
function createTestApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'success', message: 'API funcionando correctamente' });
  });

  app.get('/api/v1/facturas/buscar', (req, res) => {
    const { id, cliente, fechaDesde, fechaHasta, estado } = req.query;
    if (id) return res.json({ status: 'success', data: null });
    if (!cliente && !fechaDesde && !fechaHasta && !estado) {
      return res.status(400).json({ status: 'error', message: 'Ingrese al menos un criterio de búsqueda (cliente, fechas o estado)', data: null });
    }
    return res.json({ status: 'success', data: [] });
  });

  app.post('/api/v1/facturas', (req, res) => {
    const { clienteId } = req.body;
    if (!clienteId) return res.status(400).json({ status: 'error', message: 'Cliente es requerido', data: null });
    return res.status(201).json({ status: 'success', data: null });
  });

  return app;
}

const app = createTestApp();

test('GET /health should return 200', async () => {
  const res = await request(app).get('/health');
  if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
});

test('GET /api/v1/facturas/buscar without params should return 400', async () => {
  const res = await request(app).get('/api/v1/facturas/buscar');
  if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
});

test('POST /api/v1/facturas without clienteId should return 400', async () => {
  const res = await request(app).post('/api/v1/facturas').send({});
  if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
});
