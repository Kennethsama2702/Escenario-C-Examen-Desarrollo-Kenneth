# API de gestión de recursos del pesebre (Escenario C)

API REST en Node.js (Express) que administra los recursos del pesebre de Belén y a sus animales. Para reabastecer consulta el servicio SOAP heredado `MercadoBelenService` a través de un adaptador y sigue funcionando cuando ese servicio falla.

**Escenario resuelto: C.** Incluye el extra `GET /api/pesebre/resumen`.

## Cómo levantar el proyecto

Requiere Node.js 20 o superior.

```bash
npm install
cp .env.example .env        # y ajusta los valores si hace falta
npm start                   # API en http://localhost:3000
```

Por defecto la API espera el SOAP en `http://localhost:4000/mercado`. Hay dos opciones:

- **Mock del docente:** pon su endpoint en `MERCADO_SOAP_URL` dentro de `.env`.
- **Mock local** (para desarrollar sin red): `npm run mock` en otra terminal. Se comporta así: cantidad `999` devuelve el `soap:Fault` "Mercado cerrado", `998` no responde (prueba del timeout), cantidad mayor a `100` devuelve `SIN_EXISTENCIAS` y cualquier otra `DISPONIBLE`. El umbral de 100 es una convención de este mock; el del docente solo garantiza el `999`.

Pruebas automáticas (levantan su propio mock y la API en puertos libres): `npm test`.

## Variables de entorno

| Variable | Descripción | Valor en `.env.example` |
|---|---|---|
| `PORT` | Puerto de la API | `3000` |
| `JWT_SECRET` | Secreto para firmar y verificar los JWT | marcador de posición, cámbialo |
| `MERCADO_SOAP_URL` | Endpoint del servicio SOAP | `http://localhost:4000/mercado` |
| `MERCADO_TIMEOUT_MS` | Tiempo máximo de espera al SOAP | `3000` |
| `APP_TIMEZONE` | Zona horaria para decidir "el mismo día" al alimentar | `America/Guayaquil` |

El archivo `.env` está en `.gitignore`. Solo se versiona `.env.example`.

## Usuarios y tokens de prueba

La autenticación usa JWT (HS256) en el header `Authorization: Bearer <token>`; el rol va en el claim `rol`. Solo `ENCARGADO_PESEBRE` puede escribir sobre recursos; cualquier otro rol (`PASTOR`, `PAJE`, `ELFO`, `AYUDANTE`) recibe 403 y una petición sin token recibe 401.

Para generar tokens con tu propio `JWT_SECRET`: `npm run tokens`.

`postman/pesebre.postman_environment.json` trae tokens de `ENCARGADO_PESEBRE` y `PASTOR` firmados con el valor de `JWT_SECRET` de `.env.example`. Funcionan si copiaste ese archivo a `.env` sin cambiar el secreto. Si lo cambias, regenera el entorno con `npm run postman`.

## Endpoints

| Método | Ruta | Respuestas | Acceso |
|---|---|---|---|
| POST | `/api/recursos` | 201, 400, 409 (nombre repetido) | ENCARGADO_PESEBRE |
| GET | `/api/recursos?categoria=&estado=` | 200, 400 | pública |
| GET | `/api/recursos/{id}` | 200, 404 | pública |
| PATCH | `/api/recursos/{id}/consumo` | 200, 400, 404, 409 | ENCARGADO_PESEBRE |
| PATCH | `/api/recursos/{id}/reabastecimiento` | 200, 202, 400, 404, 422 | ENCARGADO_PESEBRE |
| DELETE | `/api/recursos/{id}` | 204, 404, 409 | ENCARGADO_PESEBRE |
| POST | `/api/animales` | 201, 400 | pública |
| GET | `/api/animales?especie=` | 200, 400 | pública |
| PATCH | `/api/animales/{id}/alimentacion` | 200, 404, 409, 422 | pública |
| GET | `/api/pesebre/resumen` (extra) | 200 | pública |

Todos los errores tienen la misma forma:

```json
{ "codigo": "STOCK_INSUFICIENTE", "mensaje": "Quedan 4 unidades y se piden 5", "detalles": [], "timestamp": "2026-12-01T10:15:00.000Z", "ruta": "/api/recursos/…/consumo" }
```

### Decisiones que conviene conocer

- Un consumo o reabastecimiento exige `cantidad` entera ≥ 1; si no, 400.
- Alimentar usa el primer recurso de categoría `ALIMENTO_ANIMALES`. Si no hay ninguno registrado, responde 409.
- Al alimentar se comprueba primero la regla del día (422) y luego el stock (409).
- "El mismo día" se calcula en la zona `APP_TIMEZONE`, no en UTC.
- El estado se recalcula con cada cambio de cantidad. Si el reabastecimiento falla, el recurso queda en `REABASTECIMIENTO_PENDIENTE` hasta el siguiente consumo o reabastecimiento exitoso.
- La persistencia es en memoria: al reiniciar la API se pierden los datos.

## Arquitectura

![Diagrama de arquitectura](docs/arquitectura.png)

(Fuente editable: [`docs/arquitectura.svg`](docs/arquitectura.svg).)

Una petición recorre: **rutas** (`src/routes`, aplican seguridad) → **controladores** (`src/controllers`, validan el formato y eligen el código HTTP) → **servicios** (`src/services`, donde viven todas las reglas de negocio) → **repositorios** (`src/repositories`, datos en memoria). El servicio de recursos llama a `MercadoAdapter` (`src/adapters`), la única clase que conoce el XML del SOAP. Todos los errores terminan en el manejador global (`src/middleware/errorHandler.js`).

**Fallo del SOAP.** El adaptador convierte un `soap:Fault`, un timeout de 3 s, un error de red o una respuesta ilegible en `MercadoNoDisponibleError`. `RecursosService.reabastecer` lo captura, deja el recurso en `REABASTECIMIENTO_PENDIENTE` sin tocar la cantidad y el controlador responde 202. Un error del SOAP nunca llega al cliente como 500.

## Colección de Postman

Importa `postman/pesebre.postman_collection.json` y `postman/pesebre.postman_environment.json`. Reinicia la API antes de correrla completa (los datos son en memoria y alimentar usa el primer recurso de alimento). Cubre 200/201, 400, 401, 403, 404, 409, 422 y el SOAP caído con respuesta 202, con aserciones en cada petición. Desde consola:

```bash
npx newman run postman/pesebre.postman_collection.json -e postman/pesebre.postman_environment.json
```

## Si el Polo Norte separara el sistema en microservicios

Separaría dos servicios. **Pesebre** es dueño de los recursos y los animales: su estado, consumos y alimentaciones, con su propia base de datos. **Abastecimiento** es dueño de los pedidos al Mercado de Belén: guarda cada pedido (categoría, cantidad, estado) y es el único que habla con el SOAP. Pesebre no lee las tablas de Abastecimiento; le envía una solicitud y recibe el resultado por evento.

Si Abastecimiento cae el 24 a las 23:00, Pesebre sigue funcionando porque consumir y alimentar solo usan sus propios datos. Reabastecer responde 202, el recurso queda en REABASTECIMIENTO_PENDIENTE y la cantidad no cambia, igual que hoy cuando falla el SOAP. Al volver, el pedido pendiente se reintenta. El riesgo real es que el alimento se agote mientras tanto y alimentar responda 409, así que conviene un stockMinimo alto antes de esa noche.
