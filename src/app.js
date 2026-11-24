const express = require('express');
const config = require('./config');
const MercadoAdapter = require('./adapters/mercado.adapter');
const RecursosRepository = require('./repositories/recursos.repository');
const AnimalesRepository = require('./repositories/animales.repository');
const { RecursosService } = require('./services/recursos.service');
const AnimalesService = require('./services/animales.service');
const PesebreService = require('./services/pesebre.service');
const { crearAuth } = require('./middleware/auth');
const { rutaNoEncontrada, manejadorErrores } = require('./middleware/errorHandler');

// Se arma todo aquí (inyección de dependencias manual) para poder probar con otras configuraciones.
function crearApp(cfg = config, { reloj } = {}) {
  if (!cfg.jwtSecret) throw new Error('Falta JWT_SECRET. Copia .env.example a .env');

  const recursosRepo = new RecursosRepository();
  const animalesRepo = new AnimalesRepository();
  const mercadoAdapter = new MercadoAdapter({ url: cfg.mercadoUrl, timeoutMs: cfg.mercadoTimeoutMs });

  const recursosService = new RecursosService({ recursosRepo, mercadoAdapter });
  const animalesService = new AnimalesService({
    animalesRepo, recursosService, recursosRepo, zonaHoraria: cfg.timezone, reloj,
  });
  const pesebreService = new PesebreService({ recursosService, animalesService });

  const auth = crearAuth(cfg.jwtSecret);
  const app = express();
  app.use(express.json());

  app.use('/api/recursos', require('./routes/recursos.routes')(require('./controllers/recursos.controller')(recursosService), auth));
  app.use('/api/animales', require('./routes/animales.routes')(require('./controllers/animales.controller')(animalesService)));
  app.use('/api/pesebre', require('./routes/pesebre.routes')(require('./controllers/pesebre.controller')(pesebreService)));

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);
  return app;
}

module.exports = { crearApp };
