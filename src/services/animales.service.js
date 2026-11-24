const { noEncontrado, conflicto, reglaNegocio } = require('../errors/AppError');

class AnimalesService {
  constructor({ animalesRepo, recursosService, recursosRepo, zonaHoraria, reloj = () => new Date() }) {
    this.animales = animalesRepo;
    this.recursosService = recursosService;
    this.recursos = recursosRepo;
    this.zona = zonaHoraria;
    this.reloj = reloj;
  }

  // Día calendario (YYYY-MM-DD) en la zona configurada, para comparar "el mismo día".
  dia(fecha) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: this.zona }).format(fecha);
  }

  registrar(datos) { return this.animales.crear(datos); }
  listar(especie) { return this.animales.listar({ especie }); }

  obtener(id) {
    const animal = this.animales.buscarPorId(id);
    if (!animal) throw noEncontrado(`No existe el animal ${id}`);
    return animal;
  }

  alimentar(id) {
    const animal = this.obtener(id);
    const ahora = this.reloj();

    // Regla 4 (422) primero: es una regla propia del animal, no depende del stock.
    if (animal.ultimaAlimentacion && this.dia(new Date(animal.ultimaAlimentacion)) === this.dia(ahora)) {
      throw reglaNegocio('ANIMAL_YA_ALIMENTADO', `${animal.nombre} ya fue alimentado hoy`);
    }

    // Regla 3: si el alimento no alcanza, 409 y no se descuenta nada.
    const alimento = this.recursos.buscarPrimeroPorCategoria('ALIMENTO_ANIMALES');
    if (!alimento) {
      throw conflicto('STOCK_INSUFICIENTE', 'No hay ningún recurso de ALIMENTO_ANIMALES registrado');
    }
    this.recursosService.consumir(alimento.id, animal.racionDiaria); // lanza 409 sin tocar nada
    animal.ultimaAlimentacion = ahora.toISOString();
    return this.animales.guardar(animal);
  }

  sinAlimentarHoy() {
    const hoy = this.dia(this.reloj());
    return this.animales.listar().filter(
      (a) => !a.ultimaAlimentacion || this.dia(new Date(a.ultimaAlimentacion)) !== hoy,
    );
  }
}

module.exports = AnimalesService;
