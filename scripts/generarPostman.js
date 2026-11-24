// Genera postman/pesebre.postman_collection.json y el entorno con tokens de prueba.
// Los tokens se firman con el JWT_SECRET de .env.example (valor de desarrollo, no un secreto real).
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const secretoEjemplo = /JWT_SECRET=(.*)/.exec(fs.readFileSync(path.join(__dirname, '../.env.example'), 'utf8'))[1].trim();
const token = (rol) => jwt.sign({ sub: `usuario-${rol.toLowerCase()}`, rol }, secretoEjemplo, { expiresIn: '365d' });

const auth = (v) => ({ Authorization: `Bearer {{${v}}}` });
const esc = (s) => s.split('\n');

function req(nombre, metodo, ruta, { headers = {}, body, tests = [], pre = [] } = {}) {
  const cabeceras = { 'Content-Type': 'application/json', ...headers };
  return {
    name: nombre,
    event: [
      ...(pre.length ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: pre } }] : []),
      { listen: 'test', script: { type: 'text/javascript', exec: tests } },
    ],
    request: {
      method: metodo,
      header: Object.entries(cabeceras).map(([key, value]) => ({ key, value })),
      url: { raw: `{{baseUrl}}${ruta}`, host: ['{{baseUrl}}'], path: ruta.split('?')[0].split('/').filter(Boolean),
        query: ruta.includes('?') ? ruta.split('?')[1].split('&').map((p) => { const [key, value] = p.split('='); return { key, value }; }) : undefined },
      body: body === undefined ? undefined : { mode: 'raw', raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2) },
    },
  };
}

const estado = (n, extra = []) => [`pm.test("Status ${n}", () => pm.response.to.have.status(${n}));`, ...extra];
const formatoError = (codigo) => [
  'const e = pm.response.json();',
  'pm.test("Formato único de error", () => pm.expect(e).to.have.all.keys("codigo","mensaje","detalles","timestamp","ruta"));',
  ...(codigo ? [`pm.test("codigo = ${codigo}", () => pm.expect(e.codigo).to.eql("${codigo}"));`] : []),
];
const nombreUnico = (pfx, v) => [`pm.collectionVariables.set("${v}", "${pfx} " + Date.now());`];

const recursos = [
  req('01 Crear recurso (201)', 'POST', '/api/recursos', {
    headers: auth('tokenEncargado'), pre: nombreUnico('Paja del establo', 'nombrePaja'),
    body: '{\n  "nombre": "{{nombrePaja}}",\n  "categoria": "PAJA",\n  "cantidad": 10,\n  "stockMinimo": 5\n}',
    tests: estado(201, ['const r = pm.response.json();', 'pm.collectionVariables.set("recursoId", r.id);',
      'pm.test("estado calculado DISPONIBLE", () => pm.expect(r.estado).to.eql("DISPONIBLE"));']),
  }),
  req('02 Ver detalle (200)', 'GET', '/api/recursos/{{recursoId}}', {
    tests: estado(200, ['pm.test("id coincide", () => pm.expect(pm.response.json().id).to.eql(pm.collectionVariables.get("recursoId")));']),
  }),
  req('03 Listar con filtros (200)', 'GET', '/api/recursos?categoria=PAJA&estado=DISPONIBLE', {
    tests: estado(200, ['pm.test("todos PAJA/DISPONIBLE", () => pm.response.json().forEach(r => { pm.expect(r.categoria).to.eql("PAJA"); pm.expect(r.estado).to.eql("DISPONIBLE"); }));']),
  }),
  req('04 Entrada inválida (400)', 'POST', '/api/recursos', {
    headers: auth('tokenEncargado'),
    body: '{\n  "nombre": "x",\n  "categoria": "ORO",\n  "cantidad": -1,\n  "stockMinimo": 0\n}',
    tests: [...estado(400), ...formatoError('FORMATO_INVALIDO')],
  }),
  req('05 Recurso inexistente (404)', 'GET', '/api/recursos/00000000-0000-0000-0000-000000000000', {
    tests: [...estado(404), ...formatoError('NO_ENCONTRADO')],
  }),
  req('06 Sin token (401)', 'POST', '/api/recursos', {
    body: '{\n  "nombre": "Sin token",\n  "categoria": "AGUA",\n  "cantidad": 1,\n  "stockMinimo": 1\n}',
    tests: [...estado(401), ...formatoError('NO_AUTENTICADO')],
  }),
  req('07 Rol insuficiente - PASTOR (403)', 'POST', '/api/recursos', {
    headers: auth('tokenPastor'),
    body: '{\n  "nombre": "Con rol equivocado",\n  "categoria": "AGUA",\n  "cantidad": 1,\n  "stockMinimo": 1\n}',
    tests: [...estado(403), ...formatoError('ROL_INSUFICIENTE')],
  }),
  req('08 Consumo que deja negativo (409)', 'PATCH', '/api/recursos/{{recursoId}}/consumo', {
    headers: auth('tokenEncargado'), body: { cantidad: 11 },
    tests: [...estado(409), ...formatoError('STOCK_INSUFICIENTE')],
  }),
  req('09 Consumo válido (200) -> BAJO_STOCK', 'PATCH', '/api/recursos/{{recursoId}}/consumo', {
    headers: auth('tokenEncargado'), body: { cantidad: 6 },
    tests: estado(200, ['const r = pm.response.json();', 'pm.test("cantidad 4", () => pm.expect(r.cantidad).to.eql(4));',
      'pm.test("estado BAJO_STOCK", () => pm.expect(r.estado).to.eql("BAJO_STOCK"));']),
  }),
  req('10 Reabastecer: SOAP responde SIN_EXISTENCIAS (422)', 'PATCH', '/api/recursos/{{recursoId}}/reabastecimiento', {
    headers: auth('tokenEncargado'), body: { cantidad: 500 },
    tests: [...estado(422), ...formatoError('SIN_EXISTENCIAS')],
  }),
  req('11 Reabastecer: SOAP responde DISPONIBLE (200)', 'PATCH', '/api/recursos/{{recursoId}}/reabastecimiento', {
    headers: auth('tokenEncargado'), body: { cantidad: 20 },
    tests: estado(200, ['pm.test("cantidad 24", () => pm.expect(pm.response.json().cantidad).to.eql(24));']),
  }),
  req('12 Reabastecer: SOAP caído, cantidad 999 (202)', 'PATCH', '/api/recursos/{{recursoId}}/reabastecimiento', {
    headers: auth('tokenEncargado'), body: { cantidad: 999 },
    tests: estado(202, ['const r = pm.response.json().recurso;',
      'pm.test("cantidad sin cambios", () => pm.expect(r.cantidad).to.eql(24));',
      'pm.test("REABASTECIMIENTO_PENDIENTE", () => pm.expect(r.estado).to.eql("REABASTECIMIENTO_PENDIENTE"));']),
  }),
  req('13 Eliminar con cantidad > 0 (409)', 'DELETE', '/api/recursos/{{recursoId}}', {
    headers: auth('tokenEncargado'),
    tests: [...estado(409), ...formatoError('RECURSO_CON_EXISTENCIAS')],
  }),
  req('14a Crear recurso con cantidad 0 (201)', 'POST', '/api/recursos', {
    headers: auth('tokenEncargado'), pre: nombreUnico('Manta vacía', 'nombreManta'),
    body: '{\n  "nombre": "{{nombreManta}}",\n  "categoria": "MANTA",\n  "cantidad": 0,\n  "stockMinimo": 2\n}',
    tests: estado(201, ['pm.collectionVariables.set("recursoVacioId", pm.response.json().id);',
      'pm.test("AGOTADO", () => pm.expect(pm.response.json().estado).to.eql("AGOTADO"));']),
  }),
  req('14b Eliminar con cantidad 0 (204)', 'DELETE', '/api/recursos/{{recursoVacioId}}', {
    headers: auth('tokenEncargado'), tests: estado(204),
  }),
];

const animales = [
  req('15 Crear recurso de alimento (201)', 'POST', '/api/recursos', {
    headers: auth('tokenEncargado'), pre: nombreUnico('Heno', 'nombreHeno'),
    body: '{\n  "nombre": "{{nombreHeno}}",\n  "categoria": "ALIMENTO_ANIMALES",\n  "cantidad": 5,\n  "stockMinimo": 2\n}',
    tests: estado(201, ['pm.collectionVariables.set("alimentoId", pm.response.json().id);']),
  }),
  req('16 Registrar animal inválido (400)', 'POST', '/api/animales', {
    body: { nombre: '', especie: 'GATO', racionDiaria: 11 },
    tests: [...estado(400), ...formatoError('FORMATO_INVALIDO')],
  }),
  req('17 Registrar animal (201)', 'POST', '/api/animales', {
    body: { nombre: 'Bueyito', especie: 'BUEY', racionDiaria: 3 },
    tests: estado(201, ['pm.collectionVariables.set("animalId", pm.response.json().id);',
      'pm.test("sin alimentar", () => pm.expect(pm.response.json().ultimaAlimentacion).to.eql(null));']),
  }),
  req('18 Listar animales ?especie=BUEY (200)', 'GET', '/api/animales?especie=BUEY', {
    tests: estado(200, ['pm.test("solo BUEY", () => pm.response.json().forEach(a => pm.expect(a.especie).to.eql("BUEY")));']),
  }),
  req('19 Alimentar (200)', 'PATCH', '/api/animales/{{animalId}}/alimentacion', {
    tests: estado(200, ['pm.test("ultimaAlimentacion llena", () => pm.expect(pm.response.json().ultimaAlimentacion).to.be.a("string"));']),
  }),
  req('20 Alimentar otra vez el mismo día (422)', 'PATCH', '/api/animales/{{animalId}}/alimentacion', {
    tests: [...estado(422), ...formatoError('ANIMAL_YA_ALIMENTADO')],
  }),
  req('21a Registrar segundo animal (201)', 'POST', '/api/animales', {
    body: { nombre: 'Mula Rosa', especie: 'MULA', racionDiaria: 3 },
    tests: estado(201, ['pm.collectionVariables.set("animal2Id", pm.response.json().id);']),
  }),
  req('21b Alimentar sin stock suficiente (409)', 'PATCH', '/api/animales/{{animal2Id}}/alimentacion', {
    tests: [...estado(409), ...formatoError('STOCK_INSUFICIENTE')],
  }),
  req('22 Extra: resumen del pesebre (200)', 'GET', '/api/pesebre/resumen', {
    tests: estado(200, ['const r = pm.response.json();', 'pm.test("campos del resumen", () => pm.expect(r).to.have.all.keys("recursosCriticos","animalesSinAlimentarHoy","listo"));']),
  }),
];

const coleccion = {
  info: {
    name: 'Pesebre - Escenario C',
    description: 'Reiniciar la API (y tener el mock SOAP arriba) antes de correr la colección completa. El orden importa: cada carpeta usa variables creadas por sus primeras peticiones.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [{ name: 'Recursos', item: recursos }, { name: 'Animales y extra', item: animales }],
  variable: ['recursoId', 'recursoVacioId', 'alimentoId', 'animalId', 'animal2Id', 'nombrePaja', 'nombreManta', 'nombreHeno'].map((key) => ({ key, value: '' })),
};
const entorno = {
  name: 'Pesebre local',
  values: [
    { key: 'baseUrl', value: 'http://localhost:3000', enabled: true },
    { key: 'tokenEncargado', value: token('ENCARGADO_PESEBRE'), enabled: true },
    { key: 'tokenPastor', value: token('PASTOR'), enabled: true },
  ],
  _postman_variable_scope: 'environment',
};
fs.mkdirSync(path.join(__dirname, '../postman'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../postman/pesebre.postman_collection.json'), JSON.stringify(coleccion, null, 2));
fs.writeFileSync(path.join(__dirname, '../postman/pesebre.postman_environment.json'), JSON.stringify(entorno, null, 2));
console.log('Colección y entorno generados en postman/');
