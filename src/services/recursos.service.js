const {
  noEncontrado, conflicto, reglaNegocio,
} = require('../errors/AppError');
const { MercadoNoDisponibleError } = require('../errors/AppError');

// Regla 1: el estado siempre se calcula, nunca lo manda el cliente.
function calcularEstado(cantidad, stockMinimo) {
  if (cantidad === 0) return 'AGOTADO';
  if (cantidad < stockMinimo) return 'BAJO_STOCK';
  return 'DISPONIBLE';
}

class RecursosService {
  constructor({ recursosRepo, mercadoAdapter }) {
    this.repo = recursosRepo;
    this.mercado = mercadoAdapter;
  }

  registrar(datos) {
    if (this.repo.buscarPorNombre(datos.nombre)) {
      throw conflicto('NOMBRE_DUPLICADO', `Ya existe un recurso llamado "${datos.nombre}"`);
    }
    return this.repo.crear({ ...datos, estado: calcularEstado(datos.cantidad, datos.stockMinimo) });
  }

  listar(filtros) { return this.repo.listar(filtros); }

  obtener(id) {
    const recurso = this.repo.buscarPorId(id);
    if (!recurso) throw noEncontrado(`No existe el recurso ${id}`);
    return recurso;
  }

  // Regla 2: un consumo que dejaría la cantidad en negativo responde 409.
  consumir(id, cantidad) {
    const recurso = this.obtener(id);
    if (cantidad > recurso.cantidad) {
      throw conflicto('STOCK_INSUFICIENTE', `Quedan ${recurso.cantidad} unidades y se piden ${cantidad}`);
    }
    return this.aplicarCantidad(recurso, recurso.cantidad - cantidad);
  }

  // Regla 5 + manejo de fallos: se consulta el SOAP antes de sumar nada.
  async reabastecer(id, cantidad) {
    const recurso = this.obtener(id);
    let existencias;
    try {
      existencias = await this.mercado.consultarExistencias(recurso.categoria, cantidad);
    } catch (err) {
      if (!(err instanceof MercadoNoDisponibleError)) throw err;
      // Fault o timeout: la cantidad no cambia, solo queda pendiente.
      recurso.estado = 'REABASTECIMIENTO_PENDIENTE';
      this.repo.guardar(recurso);
      return { confirmado: false, recurso, motivo: err.message };
    }
    if (existencias === 'SIN_EXISTENCIAS') {
      throw reglaNegocio('SIN_EXISTENCIAS', `El Mercado de Belén no tiene ${cantidad} unidades de ${recurso.categoria}`);
    }
    return { confirmado: true, recurso: this.aplicarCantidad(recurso, recurso.cantidad + cantidad) };
  }

  // Regla 6: no se elimina un recurso con existencias.
  eliminar(id) {
    const recurso = this.obtener(id);
    if (recurso.cantidad > 0) {
      throw conflicto('RECURSO_CON_EXISTENCIAS', `No se puede eliminar: quedan ${recurso.cantidad} unidades`);
    }
    this.repo.eliminar(id);
  }

  aplicarCantidad(recurso, nuevaCantidad) {
    recurso.cantidad = nuevaCantidad;
    recurso.estado = calcularEstado(recurso.cantidad, recurso.stockMinimo);
    return this.repo.guardar(recurso);
  }
}

module.exports = { RecursosService, calcularEstado };
