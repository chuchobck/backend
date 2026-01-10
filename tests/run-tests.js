import request from 'supertest';
import express from 'express';

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

async function run() {
  const app = createTestApp();
  const results = [];

  try {
    let res = await request(app).get('/health');
    results.push({ name: 'GET /health', ok: res.statusCode === 200 });

    res = await request(app).get('/api/v1/facturas/buscar');
    results.push({ name: 'GET /api/v1/facturas/buscar without params', ok: res.statusCode === 400 });

    res = await request(app).post('/api/v1/facturas').send({});
    results.push({ name: 'POST /api/v1/facturas without clienteId', ok: res.statusCode === 400 });

    const failed = results.filter(r => !r.ok);
    for (const r of results) {
      console.log(`${r.ok ? '✔' : '✖'} ${r.name}`);
    }

    if (failed.length > 0) {
      console.error(`${failed.length} test(s) failed`);
      process.exit(1);
    }

    console.log('All tests passed');
    process.exit(0);
  } catch (err) {
    console.error('Test runner error:', err);
    process.exit(2);
  }
}

run();
