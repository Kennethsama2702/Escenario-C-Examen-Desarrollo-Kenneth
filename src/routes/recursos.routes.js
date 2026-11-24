const { Router } = require('express');
const { requerirRol } = require('../middleware/auth');

const ENCARGADO = 'ENCARGADO_PESEBRE';

module.exports = (c, auth) => {
  const r = Router();
  const solo = [auth.autenticar, requerirRol(ENCARGADO)];
  r.post('/', ...solo, c.registrar);
  r.get('/', c.listar);
  r.get('/:id', c.obtener);
  r.patch('/:id/consumo', ...solo, c.consumir);
  r.patch('/:id/reabastecimiento', ...solo, c.reabastecer);
  r.delete('/:id', ...solo, c.eliminar);
  return r;
};
