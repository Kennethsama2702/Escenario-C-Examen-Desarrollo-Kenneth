const { randomUUID } = require('node:crypto');

class AnimalesRepository {
  constructor() { this.items = new Map(); }

  crear(datos) {
    const animal = { id: randomUUID(), ...datos, ultimaAlimentacion: null };
    this.items.set(animal.id, animal);
    return animal;
  }
  buscarPorId(id) { return this.items.get(id) ?? null; }
  listar({ especie } = {}) {
    return [...this.items.values()].filter((a) => !especie || a.especie === especie);
  }
  guardar(animal) { this.items.set(animal.id, animal); return animal; }
}

module.exports = AnimalesRepository;
