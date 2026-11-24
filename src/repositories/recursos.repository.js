const { randomUUID } = require('node:crypto');

class RecursosRepository {
  constructor() { this.items = new Map(); }

  crear(datos) {
    const recurso = { id: randomUUID(), ...datos };
    this.items.set(recurso.id, recurso);
    return recurso;
  }
  buscarPorId(id) { return this.items.get(id) ?? null; }
  buscarPorNombre(nombre) {
    const n = nombre.toLowerCase();
    return [...this.items.values()].find((r) => r.nombre.toLowerCase() === n) ?? null;
  }
  buscarPrimeroPorCategoria(categoria) {
    return [...this.items.values()].find((r) => r.categoria === categoria) ?? null;
  }
  listar({ categoria, estado } = {}) {
    return [...this.items.values()].filter(
      (r) => (!categoria || r.categoria === categoria) && (!estado || r.estado === estado),
    );
  }
  guardar(recurso) { this.items.set(recurso.id, recurso); return recurso; }
  eliminar(id) { return this.items.delete(id); }
}

module.exports = RecursosRepository;
