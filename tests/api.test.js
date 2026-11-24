const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { crearApp } = require('../src/app');
const { crearMock } = require('../mock/mercadoMock');

const SECRETO = 'secreto-de-test';
const token = (rol) => jwt.sign({ sub: 'u', rol }, SECRETO);
const ENC = { Authorization: `Bearer ${token('ENCARGADO_PESEBRE')}` };
const PASTOR = { Authorization: `Bearer ${token('PASTOR')}` };

let servidor, mock, base;
let fecha = new Date('2026-12-01T15:00:00Z');

test.before(async () => {
  mock = crearMock();
  await new Promise((r) => mock.listen(0, r));
  const cfg = {
    jwtSecret: SECRETO, timezone: 'America/Guayaquil', mercadoTimeoutMs: 800,
    mercadoUrl: `http://localhost:${mock.address().port}/mercado`,
  };
  servidor = crearApp(cfg, { reloj: () => fecha }).listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://localhost:${servidor.address().port}`;
});
test.after(() => { servidor.close(); mock.close(); });

async function llamar(metodo, ruta, { headers = {}, body } = {}) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  const texto = await res.text();
  return { status: res.status, json: texto ? JSON.parse(texto) : null };
}
const nuevoRecurso = (o = {}) => llamar('POST', '/api/recursos', {
  headers: ENC, body: { nombre: `R-${Math.random()}`, categoria: 'PAJA', cantidad: 10, stockMinimo: 5, ...o },
});
const formatoError = (j) => {
  assert.deepEqual(Object.keys(j).sort(), ['codigo', 'detalles', 'mensaje', 'ruta', 'timestamp']);
  assert.ok(Array.isArray(j.detalles));
};

test('crea recurso (201), calcula estado y se consulta (200)', async () => {
  const c = await nuevoRecurso({ cantidad: 3 });
  assert.equal(c.status, 201);
  assert.equal(c.json.estado, 'BAJO_STOCK');
  const g = await llamar('GET', `/api/recursos/${c.json.id}`);
  assert.equal(g.status, 200);
});

test('estado: AGOTADO, BAJO_STOCK y DISPONIBLE', async () => {
  assert.equal((await nuevoRecurso({ cantidad: 0 })).json.estado, 'AGOTADO');
  assert.equal((await nuevoRecurso({ cantidad: 4 })).json.estado, 'BAJO_STOCK');
  assert.equal((await nuevoRecurso({ cantidad: 5 })).json.estado, 'DISPONIBLE');
});

test('400 con entrada inválida y mismo formato de error', async () => {
  const r = await llamar('POST', '/api/recursos', { headers: ENC, body: { nombre: 'x', categoria: 'ORO', cantidad: -1, stockMinimo: 0, estado: 'AGOTADO' } });
  assert.equal(r.status, 400);
  formatoError(r.json);
  assert.equal(r.json.detalles.length, 5);
  const malo = await llamar('POST', '/api/recursos', { headers: ENC, body: '{roto' });
  assert.equal(malo.status, 400);
  formatoError(malo.json);
});

test('401 sin token / token falso y 403 con rol distinto', async () => {
  const sin = await llamar('POST', '/api/recursos', { body: {} });
  assert.equal(sin.status, 401);
  formatoError(sin.json);
  const falso = await llamar('POST', '/api/recursos', { headers: { Authorization: 'Bearer abc' }, body: {} });
  assert.equal(falso.status, 401);
  const rol = await llamar('POST', '/api/recursos', { headers: PASTOR, body: {} });
  assert.equal(rol.status, 403);
  formatoError(rol.json);
});

test('404 recurso inexistente y ruta inexistente', async () => {
  const r = await llamar('GET', '/api/recursos/no-existe');
  assert.equal(r.status, 404);
  formatoError(r.json);
  assert.equal((await llamar('GET', '/api/nada')).status, 404);
});

test('filtros ?categoria y ?estado, y 400 con filtro inválido', async () => {
  await nuevoRecurso({ categoria: 'MANTA', cantidad: 0 });
  const l = await llamar('GET', '/api/recursos?categoria=MANTA&estado=AGOTADO');
  assert.equal(l.status, 200);
  assert.ok(l.json.length >= 1 && l.json.every((r) => r.categoria === 'MANTA' && r.estado === 'AGOTADO'));
  assert.equal((await llamar('GET', '/api/recursos?estado=XX')).status, 400);
});

test('nombre duplicado responde 409', async () => {
  await nuevoRecurso({ nombre: 'Agua del pozo', categoria: 'AGUA' });
  assert.equal((await nuevoRecurso({ nombre: 'agua del pozo', categoria: 'AGUA' })).status, 409);
});

test('consumo: descuenta, recalcula y 409 si queda negativo', async () => {
  const { json } = await nuevoRecurso({ cantidad: 10, stockMinimo: 5 });
  const ok = await llamar('PATCH', `/api/recursos/${json.id}/consumo`, { headers: ENC, body: { cantidad: 6 } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.cantidad, 4);
  assert.equal(ok.json.estado, 'BAJO_STOCK');
  const mal = await llamar('PATCH', `/api/recursos/${json.id}/consumo`, { headers: ENC, body: { cantidad: 5 } });
  assert.equal(mal.status, 409);
  assert.equal((await llamar('GET', `/api/recursos/${json.id}`)).json.cantidad, 4);
});

test('reabastecimiento: DISPONIBLE suma, SIN_EXISTENCIAS 422', async () => {
  const { json } = await nuevoRecurso({ cantidad: 1 });
  const ok = await llamar('PATCH', `/api/recursos/${json.id}/reabastecimiento`, { headers: ENC, body: { cantidad: 20 } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.cantidad, 21);
  assert.equal(ok.json.estado, 'DISPONIBLE');
  const sin = await llamar('PATCH', `/api/recursos/${json.id}/reabastecimiento`, { headers: ENC, body: { cantidad: 500 } });
  assert.equal(sin.status, 422);
  formatoError(sin.json);
});

test('SOAP Fault (999): 202, cantidad intacta y estado pendiente', async () => {
  const { json } = await nuevoRecurso({ cantidad: 2 });
  const r = await llamar('PATCH', `/api/recursos/${json.id}/reabastecimiento`, { headers: ENC, body: { cantidad: 999 } });
  assert.equal(r.status, 202);
  assert.equal(r.json.recurso.cantidad, 2);
  assert.equal(r.json.recurso.estado, 'REABASTECIMIENTO_PENDIENTE');
});

test('SOAP sin respuesta (timeout): 202, nunca 500', async () => {
  const { json } = await nuevoRecurso({ cantidad: 2 });
  const r = await llamar('PATCH', `/api/recursos/${json.id}/reabastecimiento`, { headers: ENC, body: { cantidad: 998 } });
  assert.equal(r.status, 202);
  assert.equal(r.json.recurso.estado, 'REABASTECIMIENTO_PENDIENTE');
});

test('SOAP caído del todo (puerto cerrado): 202', async () => {
  const cfg = { jwtSecret: SECRETO, timezone: 'UTC', mercadoTimeoutMs: 500, mercadoUrl: 'http://localhost:1/mercado' };
  const s = crearApp(cfg).listen(0);
  await new Promise((r) => s.once('listening', r));
  const url = `http://localhost:${s.address().port}`;
  const h = { 'Content-Type': 'application/json', ...ENC };
  const c = await (await fetch(`${url}/api/recursos`, { method: 'POST', headers: h, body: JSON.stringify({ nombre: 'Lámpara', categoria: 'LAMPARA_ACEITE', cantidad: 1, stockMinimo: 1 }) })).json();
  const r = await fetch(`${url}/api/recursos/${c.id}/reabastecimiento`, { method: 'PATCH', headers: h, body: JSON.stringify({ cantidad: 5 }) });
  assert.equal(r.status, 202);
  s.close();
});

test('DELETE: 409 con existencias, 204 en cero, 404 después', async () => {
  const { json } = await nuevoRecurso({ cantidad: 2 });
  assert.equal((await llamar('DELETE', `/api/recursos/${json.id}`, { headers: ENC })).status, 409);
  await llamar('PATCH', `/api/recursos/${json.id}/consumo`, { headers: ENC, body: { cantidad: 2 } });
  assert.equal((await llamar('DELETE', `/api/recursos/${json.id}`, { headers: ENC })).status, 204);
  assert.equal((await llamar('GET', `/api/recursos/${json.id}`)).status, 404);
});

test('animales: alimentar descuenta, 422 el mismo día, 409 sin stock, otro día sí', async () => {
  const alimento = (await nuevoRecurso({ nombre: 'Heno', categoria: 'ALIMENTO_ANIMALES', cantidad: 5, stockMinimo: 2 })).json;
  const bueyes = (await llamar('POST', '/api/animales', { body: { nombre: 'Bueyito', especie: 'BUEY', racionDiaria: 3 } })).json;
  const mula = (await llamar('POST', '/api/animales', { body: { nombre: 'Mula', especie: 'MULA', racionDiaria: 3 } })).json;
  assert.equal((await llamar('POST', '/api/animales', { body: { nombre: '', especie: 'GATO', racionDiaria: 11 } })).status, 400);

  const ok = await llamar('PATCH', `/api/animales/${bueyes.id}/alimentacion`);
  assert.equal(ok.status, 200);
  assert.ok(ok.json.ultimaAlimentacion);
  assert.equal((await llamar('GET', `/api/recursos/${alimento.id}`)).json.cantidad, 2);

  assert.equal((await llamar('PATCH', `/api/animales/${bueyes.id}/alimentacion`)).status, 422);

  const sin = await llamar('PATCH', `/api/animales/${mula.id}/alimentacion`);
  assert.equal(sin.status, 409);
  assert.equal((await llamar('GET', `/api/recursos/${alimento.id}`)).json.cantidad, 2); // nada descontado
  assert.equal(mula.ultimaAlimentacion, null);

  fecha = new Date('2026-12-02T15:00:00Z'); // día siguiente
  await llamar('PATCH', `/api/recursos/${alimento.id}/reabastecimiento`, { headers: ENC, body: { cantidad: 10 } });
  assert.equal((await llamar('PATCH', `/api/animales/${bueyes.id}/alimentacion`)).status, 200);

  const f = await llamar('GET', '/api/animales?especie=MULA');
  assert.ok(f.json.every((a) => a.especie === 'MULA'));
  assert.equal((await llamar('GET', '/api/animales?especie=GATO')).status, 400);
});

test('extra: resumen del pesebre', async () => {
  const r = await llamar('GET', '/api/pesebre/resumen');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.recursosCriticos));
  assert.ok(Array.isArray(r.json.animalesSinAlimentarHoy));
  assert.equal(typeof r.json.listo, 'boolean');
});
