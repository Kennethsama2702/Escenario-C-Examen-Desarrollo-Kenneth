const { CATEGORIAS, ESTADOS, esEntero, exigir, exigirObjeto } = require('./comunes');

function validarNuevoRecurso(body) {
  exigirObjeto(body);
  const p = [];
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  if (nombre.length < 2 || nombre.length > 60) p.push({ campo: 'nombre', error: 'obligatorio, de 2 a 60 caracteres' });
  if (!CATEGORIAS.includes(body.categoria)) p.push({ campo: 'categoria', error: `debe ser una de: ${CATEGORIAS.join(', ')}` });
  if (!esEntero(body.cantidad) || body.cantidad < 0) p.push({ campo: 'cantidad', error: 'debe ser un entero mayor o igual a 0' });
  if (!esEntero(body.stockMinimo) || body.stockMinimo < 1) p.push({ campo: 'stockMinimo', error: 'debe ser un entero mayor o igual a 1' });
  if ('estado' in body) p.push({ campo: 'estado', error: 'lo calcula el sistema, no se envía' });
  exigir(p);
  return { nombre, categoria: body.categoria, cantidad: body.cantidad, stockMinimo: body.stockMinimo };
}

function validarFiltros(query) {
  const p = [];
  if (query.categoria !== undefined && !CATEGORIAS.includes(query.categoria)) {
    p.push({ campo: 'categoria', error: `debe ser una de: ${CATEGORIAS.join(', ')}` });
  }
  if (query.estado !== undefined && !ESTADOS.includes(query.estado)) {
    p.push({ campo: 'estado', error: `debe ser uno de: ${ESTADOS.join(', ')}` });
  }
  exigir(p);
  return { categoria: query.categoria, estado: query.estado };
}

module.exports = { validarNuevoRecurso, validarFiltros };
