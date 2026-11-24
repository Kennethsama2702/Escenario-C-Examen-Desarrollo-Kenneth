const { AppError } = require('../errors/AppError');

const respuesta = (req, status, codigo, mensaje, detalles = []) => ({
  codigo, mensaje, detalles, timestamp: new Date().toISOString(), ruta: req.originalUrl,
});

function rutaNoEncontrada(req, res) {
  res.status(404).json(respuesta(req, 404, 'NO_ENCONTRADO', `No existe la ruta ${req.method} ${req.originalUrl}`));
}

// Manejador global: todo error, venga de donde venga, sale con el mismo formato.
// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json(respuesta(req, err.status, err.codigo, err.message, err.detalles));
  }
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json(respuesta(req, 400, 'FORMATO_INVALIDO', 'El cuerpo no es un JSON válido'));
  }
  console.error(err);
  return res.status(500).json(respuesta(req, 500, 'ERROR_INTERNO', 'Error interno del servidor'));
}

module.exports = { rutaNoEncontrada, manejadorErrores };
