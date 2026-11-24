const { ESPECIES, esEntero, exigir, exigirObjeto } = require('./comunes');

function validarNuevoAnimal(body) {
  exigirObjeto(body);
  const p = [];
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  if (!nombre) p.push({ campo: 'nombre', error: 'es obligatorio' });
  if (!ESPECIES.includes(body.especie)) p.push({ campo: 'especie', error: `debe ser una de: ${ESPECIES.join(', ')}` });
  if (!esEntero(body.racionDiaria) || body.racionDiaria < 1 || body.racionDiaria > 10) {
    p.push({ campo: 'racionDiaria', error: 'debe ser un entero entre 1 y 10' });
  }
  if ('ultimaAlimentacion' in body) p.push({ campo: 'ultimaAlimentacion', error: 'la llena el sistema al alimentar' });
  exigir(p);
  return { nombre, especie: body.especie, racionDiaria: body.racionDiaria };
}

function validarFiltroEspecie(query) {
  if (query.especie !== undefined && !ESPECIES.includes(query.especie)) {
    exigir([{ campo: 'especie', error: `debe ser una de: ${ESPECIES.join(', ')}` }]);
  }
  return query.especie;
}

module.exports = { validarNuevoAnimal, validarFiltroEspecie };
