const { validarNuevoRecurso, validarFiltros } = require('../validators/recurso.validator');
const { validarCantidadPositiva } = require('../validators/comunes');

// Controladores delgados: validan formato, llaman al servicio y eligen el código HTTP.
module.exports = (servicio) => ({
  registrar: (req, res) => res.status(201).json(servicio.registrar(validarNuevoRecurso(req.body))),
  listar: (req, res) => res.json(servicio.listar(validarFiltros(req.query))),
  obtener: (req, res) => res.json(servicio.obtener(req.params.id)),
  consumir: (req, res) => res.json(servicio.consumir(req.params.id, validarCantidadPositiva(req.body))),

  async reabastecer(req, res) {
    const cantidad = validarCantidadPositiva(req.body);
    const { confirmado, recurso } = await servicio.reabastecer(req.params.id, cantidad);
    if (confirmado) return res.json(recurso);
    return res.status(202).json({
      mensaje: 'El Mercado de Belén no respondió. El reabastecimiento quedó pendiente y se confirmará después.',
      recurso,
    });
  },

  eliminar(req, res) {
    servicio.eliminar(req.params.id);
    res.status(204).end();
  },
});
