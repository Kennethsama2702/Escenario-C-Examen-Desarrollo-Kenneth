const jwt = require('jsonwebtoken');
const { noAutenticado, rolInsuficiente } = require('../errors/AppError');

// Fábrica: recibe el secreto y devuelve los middlewares ya configurados.
function crearAuth(secreto) {
  function autenticar(req, res, next) {
    const cabecera = req.get('Authorization');
    if (!cabecera) throw noAutenticado('Falta el header Authorization');
    const [esquema, token] = cabecera.split(' ');
    if (esquema !== 'Bearer' || !token) throw noAutenticado('Usa el formato "Authorization: Bearer <token>"');
    try {
      const payload = jwt.verify(token, secreto, { algorithms: ['HS256'] });
      req.usuario = { id: payload.sub, rol: payload.rol };
    } catch {
      throw noAutenticado('Token inválido o vencido');
    }
    next();
  }
  return { autenticar };
}

// 403 si el token es válido pero el rol no es el exigido.
const requerirRol = (...roles) => (req, res, next) => {
  if (!roles.includes(req.usuario?.rol)) {
    throw rolInsuficiente(`Se requiere el rol ${roles.join(' o ')}; tu rol es ${req.usuario?.rol ?? 'desconocido'}`);
  }
  next();
};

module.exports = { crearAuth, requerirRol };
