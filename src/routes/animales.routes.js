const { Router } = require('express');

module.exports = (c) => {
  const r = Router();
  r.post('/', c.registrar);
  r.get('/', c.listar);
  r.patch('/:id/alimentacion', c.alimentar);
  return r;
};
