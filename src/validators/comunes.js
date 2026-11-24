const { formatoInvalido } = require('../errors/AppError');

const CATEGORIAS = ['PAJA', 'MANTA', 'AGUA', 'ALIMENTO_ANIMALES', 'LAMPARA_ACEITE'];
const ESTADOS = ['DISPONIBLE', 'BAJO_STOCK', 'AGOTADO', 'REABASTECIMIENTO_PENDIENTE'];
const ESPECIES = ['BUEY', 'MULA', 'OVEJA'];

const esEntero = (v) => typeof v === 'number' && Number.isInteger(v);

// Lanza un 400 con todos los problemas juntos si la lista no está vacía.
function exigir(problemas) {
  if (problemas.length) throw formatoInvalido('La petición contiene datos inválidos', problemas);
}

function exigirObjeto(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw formatoInvalido('El cuerpo debe ser un objeto JSON');
  }
}

// Valida el cuerpo {"cantidad": n} de consumo y reabastecimiento (entero ≥ 1).
function validarCantidadPositiva(body) {
  exigirObjeto(body);
  const problemas = [];
  if (!esEntero(body.cantidad) || body.cantidad < 1) {
    problemas.push({ campo: 'cantidad', error: 'debe ser un entero mayor o igual a 1' });
  }
  exigir(problemas);
  return body.cantidad;
}

module.exports = { CATEGORIAS, ESTADOS, ESPECIES, esEntero, exigir, exigirObjeto, validarCantidadPositiva };
