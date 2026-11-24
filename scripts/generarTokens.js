// Imprime tokens JWT de prueba firmados con JWT_SECRET (de .env o del entorno).
require('dotenv').config({ quiet: true });
const jwt = require('jsonwebtoken');

const secreto = process.env.JWT_SECRET;
if (!secreto) { console.error('Define JWT_SECRET (copia .env.example a .env)'); process.exit(1); }

const roles = ['ENCARGADO_PESEBRE', 'PASTOR', 'PAJE', 'ELFO', 'AYUDANTE'];
for (const rol of roles) {
  const token = jwt.sign({ sub: `usuario-${rol.toLowerCase()}`, rol }, secreto, { algorithm: 'HS256', expiresIn: '30d' });
  console.log(`${rol}\n${token}\n`);
}
