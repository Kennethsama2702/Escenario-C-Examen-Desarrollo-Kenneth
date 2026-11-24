// Errores de dominio. El manejador global los convierte al formato único de respuesta.
class AppError extends Error {
  constructor(status, codigo, mensaje, detalles = []) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

const formatoInvalido = (mensaje, detalles = []) => new AppError(400, 'FORMATO_INVALIDO', mensaje, detalles);
const noAutenticado = (mensaje) => new AppError(401, 'NO_AUTENTICADO', mensaje);
const rolInsuficiente = (mensaje) => new AppError(403, 'ROL_INSUFICIENTE', mensaje);
const noEncontrado = (mensaje) => new AppError(404, 'NO_ENCONTRADO', mensaje);
const conflicto = (codigo, mensaje) => new AppError(409, codigo, mensaje);
const reglaNegocio = (codigo, mensaje) => new AppError(422, codigo, mensaje);
const servicioNoDisponible = (mensaje) => new AppError(503, 'SERVICIO_EXTERNO_NO_DISPONIBLE', mensaje);

// Lo lanza el adaptador SOAP cuando hay Fault, timeout o respuesta ilegible.
class MercadoNoDisponibleError extends Error {
  constructor(motivo) {
    super(motivo);
    this.name = 'MercadoNoDisponibleError';
  }
}

module.exports = {
  AppError, MercadoNoDisponibleError,
  formatoInvalido, noAutenticado, rolInsuficiente, noEncontrado,
  conflicto, reglaNegocio, servicioNoDisponible,
};
