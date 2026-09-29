# Evidencia: errores en formato RFC 7807 (Problem Details)

Respuestas reales de la API capturadas con `curl -i` contra los endpoints de prueba de
`PruebasErroresController`. Todas las arma `ExceptionMiddleware` (`Presentation.API/Middleware/`).

| Endpoint | Excepción lanzada | Código |
| :--- | :--- | :---: |
| `GET /pruebas/errores/no-encontrado` | `KeyNotFoundException` | 404 |
| `GET /pruebas/errores/operacion-invalida` | `InvalidOperationException` | 400 |
| `GET /pruebas/errores/interno` | `NullReferenceException` (cualquier otra) | 500 |

En el caso 500 el mensaje original de la excepción (`"Detalle interno que el cliente nunca debe ver."`)
y el stack trace **no** llegan al cliente: solo quedan en el log del servidor, enlazados por el `traceId`.

## GET /pruebas/errores/no-encontrado

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Recurso no encontrado",
  "status": 404,
  "detail": "No existe el producto con id 00000000-0000-0000-0000-000000000000.",
  "instance": "/pruebas/errores/no-encontrado",
  "traceId": "00-6983e8747cafae717d9f3c825db53bf5-c1aa547424847f9d-00"
}
```

## GET /pruebas/errores/operacion-invalida

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Solicitud inválida",
  "status": 400,
  "detail": "No se puede aprobar un pedido que ya fue entregado.",
  "instance": "/pruebas/errores/operacion-invalida",
  "traceId": "00-a8948bd38c69297c10c5cea4d29b7604-67d7cb0e3ac7593c-00"
}
```

## GET /pruebas/errores/interno

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.6.1",
  "title": "Error interno del servidor",
  "status": 500,
  "detail": "Ocurrió un error inesperado. Intenta de nuevo más tarde.",
  "instance": "/pruebas/errores/interno",
  "traceId": "00-10fcd3896740ada78be4893161d35ba1-8af588fbaa029495-00"
}
```

## Escenario hipotético: pasarela de pago rechaza la transacción

> **Nota:** esta sección **no** es una respuesta capturada. La API todavía no integra una pasarela
> de pago (los pagos se registran con captura). Se documenta cómo respondería el
> `ExceptionMiddleware` actual y cuál sería la respuesta recomendada. La ruta, los identificadores
> y el dominio `api.almacen.com` son ilustrativos.

La respuesta depende del tipo de excepción que lance el código que llama a la pasarela.

### Caso 1: el servicio lanza `InvalidOperationException` → 400

```csharp
throw new InvalidOperationException("La pasarela rechazó la transacción: datos de tarjeta inválidos.");
```

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Solicitud inválida",
  "status": 400,
  "detail": "La pasarela rechazó la transacción: datos de tarjeta inválidos.",
  "instance": "/pedidos/3f2a9c1e-7b4d-4e8a-9f10-2c6d8e5a1b70/pago",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00"
}
```

### Caso 2: el SDK o el `HttpClient` de la pasarela lanza su propia excepción → 500

Por ejemplo `HttpRequestException` o una excepción del SDK. No es de ningún tipo reconocido, así que
cae en el caso general: el motivo real solo queda en el log del servidor.

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.6.1",
  "title": "Error interno del servidor",
  "status": 500,
  "detail": "Ocurrió un error inesperado. Intenta de nuevo más tarde.",
  "instance": "/pedidos/3f2a9c1e-7b4d-4e8a-9f10-2c6d8e5a1b70/pago",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00"
}
```

Semánticamente es incorrecto: una tarjeta inválida es un error del cliente, no una falla del
servidor, y el usuario no sabe que debe corregir sus datos.

### Respuesta recomendada: 422 con `type` propio y extensiones

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json

{
  "type": "https://api.almacen.com/problemas/pago-rechazado",
  "title": "Pago rechazado",
  "status": 422,
  "detail": "La pasarela rechazó la transacción porque los datos de la tarjeta son inválidos.",
  "instance": "/pedidos/3f2a9c1e-7b4d-4e8a-9f10-2c6d8e5a1b70/pago",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
  "codigoRechazo": "TARJETA_INVALIDA",
  "reintentable": true
}
```

El middleware actual **no** genera esta respuesta. Haría falta:

- Una excepción propia (por ejemplo `PagoRechazadoException`) con `CodigoRechazo` y `Reintentable`.
- Un nuevo caso en el `switch` de `ExceptionMiddleware` que responda 422.
- Agregar esas propiedades a `problema.Extensions`.

**Seguridad (PCI-DSS):** ni `detail` ni las extensiones deben incluir el número de tarjeta, el CVV ni
la fecha de vencimiento; solo un código de rechazo genérico.

