// Mock LOCAL del MercadoBelenService, solo para desarrollo y pruebas.
// En la entrega real se usa el mock del docente (cambia MERCADO_SOAP_URL en .env).
//   cantidad 999 -> soap:Fault "Mercado cerrado"
//   cantidad 998 -> no responde (para probar el timeout de 3 s)
//   cantidad > 100 -> SIN_EXISTENCIAS
//   cualquier otra -> DISPONIBLE
const http = require('node:http');

const NS = 'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mb="http://belen.beatlech/mercado"';
const sobre = (cuerpo) => `<?xml version="1.0"?><soap:Envelope ${NS}><soap:Body>${cuerpo}</soap:Body></soap:Envelope>`;

function crearMock() {
  return http.createServer((req, res) => {
    let datos = '';
    req.on('data', (c) => { datos += c; });
    req.on('end', () => {
      const cantidad = Number(/<(?:\w+:)?cantidad>(\d+)</.exec(datos)?.[1]);
      res.setHeader('Content-Type', 'text/xml; charset=utf-8');
      if (cantidad === 998) return; // cuelga la conexión a propósito
      if (cantidad === 999) {
        res.statusCode = 500;
        return res.end(sobre('<soap:Fault><faultcode>soap:Server</faultcode><faultstring>Mercado cerrado</faultstring></soap:Fault>'));
      }
      const resultado = cantidad > 100 ? 'SIN_EXISTENCIAS' : 'DISPONIBLE';
      return res.end(sobre(`<mb:ConsultarExistenciasResponse><mb:resultado>${resultado}</mb:resultado></mb:ConsultarExistenciasResponse>`));
    });
  });
}

if (require.main === module) {
  const puerto = Number(process.env.MOCK_PORT) || 4000;
  crearMock().listen(puerto, () => console.log(`Mock SOAP en http://localhost:${puerto}/mercado`));
}

module.exports = { crearMock };
