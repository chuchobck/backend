import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRes } from '../utils/resMock.js';

const controller = await import('../../src/controllers/ajusteInventario.controller.js');

function mockReq({ params = {}, query = {}, body = {} } = {}) {
  return { params, query, body };
}

test('crearAjuste faltan campos requeridos retorna 400', async () => {
  const req = mockReq({ body: { tipo: 'E', detalles: [{ id_producto: 1, cantidad: 1 }] } });
  const res = createRes();
  const next = () => {};
  await controller.crearAjuste(req, res, next);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.status, 'error');
});

test('crearAjuste tipo inválido retorna 400', async () => {
  const req = mockReq({ body: { descripcion: 'x', tipo: 'X', detalles: [{ id_producto: 1, cantidad: 1 }] } });
  const res = createRes();
  const next = () => {};
  await controller.crearAjuste(req, res, next);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.status, 'error');
});

test('crearAjuste detalles no array retorna 400', async () => {
  const req = mockReq({ body: { descripcion: 'x', tipo: 'E', detalles: null } });
  const res = createRes();
  const next = () => {};
  await controller.crearAjuste(req, res, next);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.status, 'error');
});
