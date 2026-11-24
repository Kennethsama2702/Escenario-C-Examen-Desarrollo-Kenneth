const config = require('./config');
const { crearApp } = require('./app');

crearApp(config).listen(config.port, () => {
  console.log(`API del pesebre escuchando en http://localhost:${config.port}`);
  console.log(`Mercado SOAP: ${config.mercadoUrl} (timeout ${config.mercadoTimeoutMs} ms)`);
});
