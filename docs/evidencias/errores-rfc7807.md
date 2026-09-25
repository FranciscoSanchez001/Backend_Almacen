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

