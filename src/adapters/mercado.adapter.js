const { XMLParser } = require('fast-xml-parser');
const { MercadoNoDisponibleError } = require('../errors/AppError');

const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const NS_MERCADO = 'http://belen.beatlech/mercado';

const escaparXml = (s) => String(s).replace(/[<>&'"]/g, (c) => (
  { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
));

/**
 * Adaptador del servicio SOAP MercadoBelenService.
 * Es el único lugar que conoce XML: recibe (categoria, cantidad) y devuelve
 * 'DISPONIBLE' | 'SIN_EXISTENCIAS'. Cualquier otra cosa (Fault, timeout, red caída,
 * respuesta ilegible) se traduce a MercadoNoDisponibleError.
 */
class MercadoAdapter {
  constructor({ url, timeoutMs = 3000 }) {
    this.url = url;
    this.timeoutMs = timeoutMs;
    this.parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true });
  }

  construirSobre(categoria, cantidad) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:mb="${NS_MERCADO}">
  <soapenv:Body>
    <mb:ConsultarExistenciasRequest>
      <mb:categoria>${escaparXml(categoria)}</mb:categoria>
      <mb:cantidad>${escaparXml(cantidad)}</mb:cantidad>
    </mb:ConsultarExistenciasRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  async consultarExistencias(categoria, cantidad) {
    let texto;
    try {
      const respuesta = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"ConsultarExistencias"' },
        body: this.construirSobre(categoria, cantidad),
        signal: AbortSignal.timeout(this.timeoutMs), // corta a los 3 s
      });
      // Los Fault SOAP suelen venir con HTTP 500; se lee el cuerpo igual.
      texto = await respuesta.text();
    } catch (err) {
      const motivo = err.name === 'TimeoutError' ? `sin respuesta en ${this.timeoutMs} ms` : `error de red (${err.message})`;
      throw new MercadoNoDisponibleError(motivo);
    }
    return this.interpretar(texto);
  }

  interpretar(xml) {
    let cuerpo;
    try {
      cuerpo = this.parser.parse(xml)?.Envelope?.Body;
    } catch {
      throw new MercadoNoDisponibleError('respuesta XML ilegible');
    }
    if (!cuerpo) throw new MercadoNoDisponibleError('respuesta SOAP sin Body');
    if (cuerpo.Fault) {
      throw new MercadoNoDisponibleError(`Fault: ${cuerpo.Fault.faultstring ?? 'sin detalle'}`);
    }
    const resultado = cuerpo.ConsultarExistenciasResponse?.resultado ?? cuerpo.resultado;
    if (resultado === 'DISPONIBLE' || resultado === 'SIN_EXISTENCIAS') return resultado;
    throw new MercadoNoDisponibleError(`resultado inesperado: ${JSON.stringify(resultado)}`);
  }
}

module.exports = MercadoAdapter;
