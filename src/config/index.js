require('dotenv').config({ quiet: true });

module.exports = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET,
  mercadoUrl: process.env.MERCADO_SOAP_URL || 'http://localhost:4000/mercado',
  mercadoTimeoutMs: Number(process.env.MERCADO_TIMEOUT_MS) || 3000,
  timezone: process.env.APP_TIMEZONE || 'America/Guayaquil',
};
