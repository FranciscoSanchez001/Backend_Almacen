# Evidencias — Escenarios de seguridad (Postman)

[← Volver al README](../../src/backend/README.md#11-pruebas-de-la-api)

Resultado real de ejecutar, petición por petición, la colección [`Seguridad_Escenarios.postman_collection.json`](../postman/Seguridad_Escenarios.postman_collection.json) contra la API en desarrollo (`http://localhost:5085`), con PostgreSQL 16 recién migrado. Comando:

```bash
npx newman run docs/postman/Seguridad_Escenarios.postman_collection.json --env-var "baseUrl=http://localhost:5085"
```

Fecha de ejecución: **2026-10-02 01:55 UTC**. Roles: **Admin** = `superadmin`, **Employee** = `ventas`.

## Resumen

| Escenario | Petición | Esperado | Obtenido | Aserciones |
| :--- | :--- | :---: | :---: | :---: |
| 1a. Login Admin (superadmin) | `POST /api/auth/login` | 200 | `200 OK` | 3/3 ✅ |
| Preparar: Admin crea el Employee de prueba | `POST /usuarios` | 201 / 409 | `201 Created` | 1/1 ✅ |
| 1b. Login Employee (ventas) | `POST /api/auth/login` | 200 | `200 OK` | 3/3 ✅ |
| 2. GET /productos sin token | `GET /productos` | 401 | `401 Unauthorized` | 4/4 ✅ |
| 3. Employee intenta DELETE /productos/{id} | `DELETE /productos/a1000000-0000-4000-8000-000000000001` | 403 | `403 Forbidden` | 3/3 ✅ |
| 3b. Admin comprueba que el producto sigue activo | `GET /productos/a1000000-0000-4000-8000-000000000001` | 200 | `200 OK` | 2/2 ✅ |
| 4. POST /productos con precio negativo | `POST /productos` | 400 | `400 Bad Request` | 5/5 ✅ |

**Total: 7 peticiones, 21 aserciones, 0 fallos.**

Los tokens se muestran abreviados. El encabezado `Authorization` se indica con el token que usa cada petición.

---

## 1. Login exitoso con rol Admin y Employee

### 1a. Login Admin (superadmin) — 200

Público. Superadmin sembrado al arrancar la API (sección `SuperadminInicial`). Guarda `tokenAdmin`.

**Petición**

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{
  "email": "gerente@almacen.local",
  "password": "Cambiar123!"
}
```

**Respuesta** — `200 OK` en 1371 ms

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ…aXic0TWbv8",
  "expiraEn": "2026-10-02T09:55:15.7657072Z",
  "username": "Gerente",
  "email": "gerente@almacen.local",
  "rol": "superadmin",
  "usuario": {
    "id": "01a0fa52-80b9-7753-afc8-8f3ca36dc6f2",
    "nombre": "Gerente",
    "email": "gerente@almacen.local",
    "rol": "superadmin"
  },
  "refreshToken": "TnNim8z3uCq4…",
  "refreshExpiraEn": "2026-10-09T01:55:15.6346664Z"
}
```

Token decodificado (cabecera y claims):

```json
{"alg": "HS256", "typ": "JWT"}
{
  "aud": "backend-almacen",
  "iss": "backend-almacen",
  "exp": 1790934915,
  "jti": "d37654f2-3251-4665-85a9-d5d255868ba0",
  "sub": "01a0fa52-80b9-7753-afc8-8f3ca36dc6f2",
  "name": "Gerente",
  "email": "gerente@almacen.local",
  "role": "superadmin",
  "iat": 1790906115,
  "nbf": 1790906115
}
```

**Aserciones**

- ✅ 200 OK
- ✅ Respuesta con token, username, email y rol superadmin
- ✅ JWT HS256 con claim role = superadmin y exp futura

### Preparar: Admin crea el Employee de prueba — 201 / 409

Solo Admin. Crea un usuario con rol `ventas` (Employee). Si ya existe de una ejecución anterior responde 409, que también es válido.

**Petición**

```http
POST /usuarios HTTP/1.1
Authorization: Bearer {{tokenAdmin}}
Content-Type: application/json

{
  "nombre": "Empleado Pruebas",
  "email": "empleado.pruebas@almacen.local",
  "telefono": null,
  "rol": "ventas",
  "password": "Empleado123!"
}
```

**Respuesta** — `201 Created` en 738 ms

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: http://localhost:5085/usuarios/01a0fa52-a928-7637-839d-d48aaa76e610

{
  "id": "01a0fa52-a928-7637-839d-d48aaa76e610",
  "nombre": "Empleado Pruebas",
  "email": "empleado.pruebas@almacen.local",
  "telefono": null,
  "rol": "ventas",
  "activo": true,
  "creadoEn": "2026-10-02T01:55:16.7099163Z"
}
```

**Aserciones**

- ✅ 201 Created o 409 si ya existía

### 1b. Login Employee (ventas) — 200

Público. Login del Employee creado en el paso anterior. Guarda `tokenEmpleado`.

**Petición**

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{
  "email": "empleado.pruebas@almacen.local",
  "password": "Empleado123!"
}
```

**Respuesta** — `200 OK` en 370 ms

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ…tv5QvzJc7w",
  "expiraEn": "2026-10-02T09:55:17.3599916Z",
  "username": "Empleado Pruebas",
  "email": "empleado.pruebas@almacen.local",
  "rol": "ventas",
  "usuario": {
    "id": "01a0fa52-a928-7637-839d-d48aaa76e610",
    "nombre": "Empleado Pruebas",
    "email": "empleado.pruebas@almacen.local",
    "rol": "ventas"
  },
  "refreshToken": "BoIhwNVdopzj…",
  "refreshExpiraEn": "2026-10-09T01:55:17.346518Z"
}
```

Token decodificado (cabecera y claims):

```json
{"alg": "HS256", "typ": "JWT"}
{
  "aud": "backend-almacen",
  "iss": "backend-almacen",
  "exp": 1790934917,
  "jti": "2cd6707f-8429-4427-8d4d-aff7a2d67256",
  "sub": "01a0fa52-a928-7637-839d-d48aaa76e610",
  "name": "Empleado Pruebas",
  "email": "empleado.pruebas@almacen.local",
  "role": "ventas",
  "iat": 1790906117,
  "nbf": 1790906117
}
```

**Aserciones**

- ✅ 200 OK
- ✅ Respuesta con token y rol ventas (Employee)
- ✅ Claim role = ventas

---

## 2. Petición a endpoint protegido sin token (401 Unauthorized)

### 2. GET /productos sin token — 401

Endpoint protegido (`[Authorize]`, solo personal) llamado sin encabezado `Authorization`.

**Petición**

```http
GET /productos HTTP/1.1
```

**Respuesta** — `401 Unauthorized` en 55 ms

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/problem+json
WWW-Authenticate: Bearer

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.2",
  "title": "No autenticado",
  "status": 401,
  "detail": "Debes iniciar sesión: envía el token en el encabezado Authorization: Bearer <token>.",
  "instance": "/productos",
  "traceId": "00-5101c627855e4dd25fe35a745833fa2d-f544f29452e7db96-00"
}
```

**Aserciones**

- ✅ 401 Unauthorized
- ✅ WWW-Authenticate: Bearer
- ✅ application/problem+json
- ✅ status 401 en el cuerpo

---

## 3. Eliminación de producto con token de Employee (403 Forbidden)

### 3. Employee intenta DELETE /productos/{id} — 403

El borrado es solo para Admin (`[Authorize(Roles = Roles.Admin)]`). Con token de Employee: 403 Forbidden. El producto es VIV-0001, sembrado por la migración.

**Petición**

```http
DELETE /productos/a1000000-0000-4000-8000-000000000001 HTTP/1.1
Authorization: Bearer {{tokenEmpleado}}
```

**Respuesta** — `403 Forbidden` en 15 ms

```http
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.4",
  "title": "Acceso denegado",
  "status": 403,
  "detail": "Tu rol no tiene permiso para realizar esta operación.",
  "instance": "/productos/a1000000-0000-4000-8000-000000000001",
  "traceId": "00-b8989ce1eb05ca50c37a82284bc88515-b37f14587c55b2ec-00"
}
```

**Aserciones**

- ✅ 403 Forbidden
- ✅ application/problem+json
- ✅ status 403 en el cuerpo

### 3b. Admin comprueba que el producto sigue activo — 200

Confirma que el 403 anterior no borró nada.

**Petición**

```http
GET /productos/a1000000-0000-4000-8000-000000000001 HTTP/1.1
Authorization: Bearer {{tokenAdmin}}
```

**Respuesta** — `200 OK` en 190 ms

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "id": "a1000000-0000-4000-8000-000000000001",
  "codigoSku": "VIV-0001",
  "nombre": "Harina de maíz precocida 1 kg",
  "descripcion": "Harina blanca para arepas.",
  "precioUsd": 1.35,
  "precioBs": null,
  "costoUsd": 1.05,
  "imagenUrl": null,
  "categoriaId": "c1000000-0000-4000-8000-000000000001",
  "categoria": "Víveres",
  "stockDisponible": 120,
  "stockReservado": 0,
  "stockMinimo": 20,
  "stockMaximo": 200,
  "bajoStockMinimo": false,
  "ubicacion": "P1-E1",
  "unidadMedida": "paquete",
  "activo": true,
  "creadoEn": "2026-09-23T00:00:00Z",
  "actualizadoEn": null
}
```

**Aserciones**

- ✅ 200 OK
- ✅ El producto sigue activo

---

## 4. Producto con precio negativo (400 Bad Request)

### 4. POST /productos con precio negativo — 400

Cuerpo válido salvo `precioUsd = -5`. FluentValidation (`CrearProductoValidator`) lo rechaza antes de llegar al controlador: 400 con Problem Details y el mensaje de validación del campo.

**Petición**

```http
POST /productos HTTP/1.1
Authorization: Bearer {{tokenEmpleado}}
Content-Type: application/json

{
  "codigoSku": "NEG-06117976",
  "nombre": "Producto con precio negativo",
  "descripcion": null,
  "precioUsd": -5,
  "costoUsd": 1.0,
  "imagenUrl": null,
  "categoriaId": "c1000000-0000-4000-8000-000000000001",
  "stockInicial": 10,
  "stockMinimo": 2,
  "stockMaximo": 20
}
```

**Respuesta** — `400 Bad Request` en 135 ms

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json; charset=utf-8

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Uno o más datos no son válidos.",
  "status": 400,
  "detail": "Revisa los campos indicados en errors.",
  "instance": "/productos",
  "errors": {
    "precioUsd": [
      "El precio debe ser mayor que 0."
    ]
  },
  "traceId": "00-e9a6714054154a347f3823b217244d02-9f23e2c5ff6ed46d-00"
}
```

**Aserciones**

- ✅ 400 Bad Request
- ✅ application/problem+json
- ✅ status 400 en el cuerpo
- ✅ Mensaje de validación en precioUsd
- ✅ Solo falla el precio
