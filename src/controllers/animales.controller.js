const { validarNuevoAnimal, validarFiltroEspecie } = require('../validators/animal.validator');

module.exports = (servicio) => ({
  registrar: (req, res) => res.status(201).json(servicio.registrar(validarNuevoAnimal(req.body))),
  listar: (req, res) => res.json(servicio.listar(validarFiltroEspecie(req.query))),
  alimentar: (req, res) => res.json(servicio.alimentar(req.params.id)),
});
