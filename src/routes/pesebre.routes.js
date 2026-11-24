const { Router } = require('express');

module.exports = (c) => {
  const r = Router();
  r.get('/resumen', c.resumen);
  return r;
};
