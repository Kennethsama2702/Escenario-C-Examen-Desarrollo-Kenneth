module.exports = (servicio) => ({
  resumen: (req, res) => res.json(servicio.resumen()),
});
