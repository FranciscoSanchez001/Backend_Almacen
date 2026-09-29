# Evidencias — Fase 3: JWT, RBAC y FluentValidation

[← Volver a ARQUITECTURA.md](../ARQUITECTURA.md#6-seguridad-stateless-jwt-rbac-y-validación-defensiva-fase-3)

Respuestas reales de la API (entorno de desarrollo, PostgreSQL 16 con las migraciones aplicadas). Se obtienen ejecutando la carpeta **Fase 3 - Seguridad (JWT, RBAC, FluentValidation)** de la [colección de Postman](../postman/Backend_Almacen.postman_collection.json) con el *Collection Runner*, o desde la terminal con Newman:

```bash
npx newman run docs/postman/Backend_Almacen.postman_collection.json \
  --folder "Fase 3 - Seguridad (JWT, RBAC, FluentValidation)" \
  --env-var "baseUrl=http://localhost:5085"
```

Resultado de la ejecución: **11 peticiones, 25 aserciones, 0 fallos** (junto con la carpeta *Errores RFC 7807*: 15 peticiones, 35 aserciones, 0 fallos).

---

## 1. Login exitoso — Admin y Employee (`200 OK`)

`POST /api/auth/login` con `{ "email": "gerente@almacen.local", "password": "Cambiar123!" }`:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJiYWNrZW5kLWFsbWFjZW4i...",
  "expiraEn": "2026-09-29T09:54:25.7446253Z",
  "username": "Gerente",
  "email": "gerente@almacen.local",
  "rol": "superadmin",
  "usuario": {
    "id": "01a0eadb-d8d1-7564-b226-0552f029a089",
    "nombre": "Gerente",
    "email": "gerente@almacen.local",
    "rol": "superadmin"
  }
}
```

Cabecera y claims del token decodificado:

```json
{ "alg": "HS256", "typ": "JWT" }
```

```json
{
  "aud": "backend-almacen",
  "iss": "backend-almacen",
  "exp": 1790675665,
  "jti": "f0f7789a-dd5e-469d-8bb0-a5af13fdcb0a",
  "sub": "01a0eadb-d8d1-7564-b226-0552f029a089",
  "name": "Gerente",
  "email": "gerente@almacen.local",
  "role": "superadmin",
  "iat": 1790646865,
  "nbf": 1790646865
}
```

El login del Employee (`empleado.fase3@almacen.local`, creado por el Admin en la colección) responde igual con `"rol": "ventas"`. Con una contraseña incorrecta la respuesta es `401` y no trae token.

## 2. Endpoint protegido sin token (`401 Unauthorized`)

`GET /productos` sin encabezado `Authorization`:

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/problem+json
WWW-Authenticate: Bearer
```

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.2",
  "title": "No autenticado",
  "status": 401,
  "detail": "Debes iniciar sesión: envía el token en el encabezado Authorization: Bearer <token>.",
  "instance": "/productos",
  "traceId": "00-66ead00ffce4e3ec94a48569562478dc-0edaffb3dbce9842-00"
}
```

## 3. Employee intenta borrar un producto (`403 Forbidden`)

`DELETE /productos/a1000000-0000-4000-8000-000000000001` con el token del Employee (`ventas`):

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.4",
  "title": "Acceso denegado",
  "status": 403,
  "detail": "Tu rol no tiene permiso para realizar esta operación.",
  "instance": "/productos/a1000000-0000-4000-8000-000000000001",
  "traceId": "00-ceeac559ce93deeb939af8cfcc7eaa99-bdf8ee1a8bde82c6-00"
}
```

El producto no se modifica. Lo mismo ocurre con `POST /categorias` (crear categoría) para el Employee; con el token del Admin ambas operaciones responden `204` y `201`.

## 4. Producto con precio negativo (`400 Bad Request`)

`POST /productos` con el token del Employee y este cuerpo:

```json
{
  "codigoSku": "PRU-0001",
  "nombre": "Producto inválido",
  "precioUsd": -5,
  "costoUsd": 1.00,
  "categoriaId": "c1000000-0000-4000-8000-000000000001",
  "stockInicial": -1,
  "stockMinimo": 10,
  "stockMaximo": 5
}
```

Respuesta de `CrearProductoValidator` (FluentValidation), sin que se llegue a ejecutar el controlador:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Uno o más datos no son válidos.",
  "status": 400,
  "detail": "Revisa los campos indicados en errors.",
  "instance": "/productos",
  "errors": {
    "precioUsd": ["El precio debe ser mayor que 0."],
    "stockMaximo": ["El stock máximo debe ser mayor que el stock mínimo."],
    "stockInicial": ["El stock inicial no puede ser negativo."]
  },
  "traceId": "00-aeb3ee3e4c6ba2e1854ac6b1c52b6697-e44b9dd7364017fd-00"
}
```

---

## Otros casos verificados

| Petición | Resultado |
| :--- | :--- |
| Employee `GET /productos` | `200` |
| Employee `POST /productos` válido (con `stockMinimo`, `stockMaximo`, `ubicacion`, `unidadMedida`) | `201` |
| Admin `DELETE /productos/{id}` | `204` |
| Admin `POST /productos` con SKU repetido | `409` Problem Details (`ConflictoException`) |
| Admin `POST /productos` con categoría inexistente | `400` Problem Details |
| Admin `POST /usuarios` con rol `superadmin`, correo inválido y contraseña corta | `400` con los tres errores en `errors` |
