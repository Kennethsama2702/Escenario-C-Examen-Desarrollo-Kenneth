// Extra: resumen del pesebre.
class PesebreService {
  constructor({ recursosService, animalesService }) {
    this.recursos = recursosService;
    this.animales = animalesService;
  }

  resumen() {
    const todos = this.recursos.listar({});
    const recursosCriticos = todos.filter((r) => r.estado === 'BAJO_STOCK' || r.estado === 'AGOTADO');
    return {
      recursosCriticos,
      animalesSinAlimentarHoy: this.animales.sinAlimentarHoy(),
      // Listo = ningún recurso agotado (y al menos uno registrado, para no declarar listo un pesebre vacío).
      listo: todos.length > 0 && !todos.some((r) => r.estado === 'AGOTADO'),
    };
  }
}

module.exports = PesebreService;
