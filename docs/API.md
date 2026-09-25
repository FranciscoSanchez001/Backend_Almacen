# Referencia de la API

[← Volver al README](../README.md)

**URL base (desarrollo):** `http://localhost:5085`  
**Formato:** JSON (salvo la creación de pedidos, que usa `multipart/form-data` para adjuntar el comprobante).  
**Autenticación:** encabezado `Authorization: Bearer <token>`.

Los valores de las enumeraciones se envían y reciben en `snake_case` (por ejemplo, `pago_movil`, `en_camino`).

## Roles

| Símbolo | Quién puede usarlo |
| :--- | :--- |
| 🌐 Público | Cualquiera, sin token |
| 🔑 Autenticado | Cualquier usuario con sesión iniciada |
| 🛒 Cliente | `cliente` |
| 🧾 Personal | `ventas` y `superadmin` |
| 🚚 Repartidor | `repartidor` (y `superadmin` donde se indica) |
| 👔 Superadmin | Solo `superadmin` |

---

## 1. Autenticación — `/auth`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `POST` | `/auth/login` | 🌐 | Inicio de sesión del personal. Cuerpo: `{ "email", "password" }`. Devuelve el token JWT. |
| `POST` | `/auth/google` | 🌐 | Inicio de sesión del cliente. Cuerpo: `{ "idToken" }` (token de Google). Si el cliente no existe, se crea. |
| `GET` | `/auth/yo` | 🔑 | Datos del usuario de la sesión actual. |

## 2. Catálogo público — `/catalogo`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/catalogo` | 🌐 | Productos activos con stock. Filtros: `q` (texto), `categoriaId`, `pagina`, `tamano` (24 por defecto). Incluye el precio en USD y en Bs. |
| `GET` | `/catalogo/{id}` | 🌐 | Detalle de un producto. |
| `GET` | `/catalogo/inicio` | 🌐 | Inicio personalizado: los más vendidos y, si hay sesión de cliente, sus productos frecuentes y últimas compras. Parámetro: `limite` (10 por defecto, máximo 30). |
| `GET` | `/catalogo/pago` | 🔑 | Datos para pagar: cuentas de transferencia, pago móvil y wallet de Binance. |
| `GET` | `/catalogo/zonas` | 🌐 | Zonas de entrega activas. |

## 3. Categorías — `/categorias`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/categorias` | 🌐 | Lista de categorías. Es pública porque la tienda la usa para filtrar el catálogo. |
| `POST` | `/categorias` | 🧾 | Crea una categoría. Cuerpo: `{ "nombre" }`. Responde `409` si el nombre ya existe. |
| `PUT` | `/categorias/{id}` | 🧾 | Renombra una categoría. |

## 4. Productos — `/productos`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/productos` | 🧾 | Lista para el personal. Filtros: `q`, `categoriaId`, `incluirInactivos`, `pagina`, `tamano`. |
| `GET` | `/productos/{id}` | 🧾 | Detalle de un producto. |
| `POST` | `/productos` | 🧾 | Crea un producto. Cuerpo: `codigoSku`, `nombre`, `descripcion`, `precioUsd`, `costoUsd`, `imagenUrl`, `categoriaId`, `stockInicial`. Queda registrado en la auditoría. |
| `PUT` | `/productos/{id}` | 🧾 | Edita un producto. Si cambia el stock disponible, se registra como ajuste de inventario. |
| `DELETE` | `/productos/{id}` | 👔 | Borrado lógico (el producto deja de aparecer en `/catalogo`, pero se conserva su historial). |

## 5. Inventario — `/inventario`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/inventario` | 🧾 | Stock disponible y reservado por producto. Filtros: `q`, `categoriaId`, `soloAgotados`. |
| `POST` | `/inventario/{productoId}/reponer` | 🧾 | Suma stock cuando llega mercancía. Cuerpo: `{ "cantidad" }`. |
| `GET` | `/inventario/{productoId}/movimientos` | 🧾 | Historial de movimientos del producto (reservas, ventas, liberaciones, reposiciones, ajustes). |

## 6. Notificaciones — `/notificaciones`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/notificaciones` | 🧾 | Avisos de producto agotado, pedido nuevo y pedido por expirar. Filtro: `soloNoLeidas` (verdadero por defecto). |
| `POST` | `/notificaciones/{id}/leer` | 🧾 | Marca una notificación como leída. |
| `POST` | `/notificaciones/leer-todas` | 🧾 | Marca todas como leídas. |

## 7. Pedidos — `/pedidos`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `POST` | `/pedidos` | 🛒 | Crea un pedido y reserva el stock. **`multipart/form-data`** (ver abajo). |
| `GET` | `/pedidos/mios` | 🛒 | Pedidos del cliente de la sesión. |
| `GET` | `/pedidos` | 🧾 | Bandeja del personal. Filtros: `estado`, `zonaId`, `repartidorId`, `desde`, `hasta`, `pagina`, `tamano`. Con `estado=pendiente` salen primero los más cerca de vencer. |
| `GET` | `/pedidos/repartidores` | 🧾 | Repartidores activos, para elegir al aprobar. |
| `GET` | `/pedidos/{id}` | 🔑 | Detalle de un pedido con su historial de estados. |
| `POST` | `/pedidos/{id}/aprobar` | 🧾 | Aprueba y asigna repartidor. Cuerpo: `{ "repartidorId" }`. Confirma el stock. |
| `POST` | `/pedidos/{id}/rechazar` | 🧾 | Rechaza el pedido y libera el stock. Cuerpo opcional: `{ "motivo" }` (por defecto, "el método de pago no procede"). |
| `POST` | `/pedidos/{id}/en-camino` | 🚚 👔 | El repartidor recogió el pedido. |
| `POST` | `/pedidos/{id}/entregado` | 🚚 👔 | El pedido fue entregado (estado final). |

### Campos para crear un pedido (`multipart/form-data`)

| Campo | Tipo | Obligatorio | Detalle |
| :--- | :--- | :---: | :--- |
| `items` | lista de `{ productoId, cantidad }` | Sí | Entre 1 y 50 productos; cantidad de 1 a 1000. |
| `metodoPago` | texto | Sí | `transferencia`, `pago_movil` o `binance`. |
| `referenciaPago` | texto | Sí | Número de referencia del pago. |
| `captura` | archivo | Sí | Imagen del comprobante. |
| `zonaId` | UUID | Sí | Zona de entrega. |
| `direccionTexto` | texto | Sí | Dirección y punto de referencia (5 a 500 caracteres). |
| `latitud`, `longitud` | número | No | Coordenadas de la dirección de entrega. |
| `telefono` | texto | Sí | Formato venezolano `+58 4XX XXX XXXX`. |

## 8. Clientes — `/clientes`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/clientes` | 🧾 | Busca clientes por nombre, correo o teléfono (`buscar`). |
| `GET` | `/clientes/{id}/pedidos` | 🧾 | Historial de compras de un cliente. |

## 9. Repartidor — `/repartidor`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/repartidor/pedidos` | 🚚 | Pedidos asignados al repartidor de la sesión. |

## 10. Usuarios del personal — `/usuarios`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/usuarios` | 👔 | Lista de usuarios. Filtros: `buscar`, `rol`, `activo`, `pagina`, `tamano`. |
| `GET` | `/usuarios/{id}` | 👔 | Detalle de un usuario. |
| `POST` | `/usuarios` | 👔 | Crea un usuario de ventas o repartidor. Cuerpo: `nombre`, `email`, `telefono`, `rol`, `password` (8 a 72 caracteres). |
| `PUT` | `/usuarios/{id}` | 👔 | Edita un usuario. |
| `POST` | `/usuarios/{id}/activar` | 👔 | Reactiva un usuario. |
| `POST` | `/usuarios/{id}/desactivar` | 👔 | Desactiva un usuario; pierde el acceso de inmediato. |

## 11. Configuración — `/configuracion`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/configuracion` | 👔 | Parámetros actuales del sistema. |
| `PUT` | `/configuracion` | 👔 | Actualiza número de soporte, horas de expiración (1 a 168), datos de transferencia, pago móvil, wallet de Binance y números de prueba de WhatsApp (hasta 20). |
| `PUT` | `/configuracion/tasa` | 👔 | Carga la **tasa Bs/USD del día**. Cuerpo: `{ "tasa" }`. Queda en el historial. **Es necesaria para que los clientes puedan crear pedidos.** |
| `GET` | `/configuracion/tasas` | 👔 | Historial de tasas cargadas. |

## 12. Zonas de entrega — `/zonas`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/zonas` | 👔 | Todas las zonas, activas e inactivas. |
| `POST` | `/zonas` | 👔 | Crea una zona. |
| `PUT` | `/zonas/{id}` | 👔 | Edita o desactiva una zona. |

## 13. Auditoría — `/auditoria`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/auditoria` | 👔 | Cambios registrados. Filtros: `usuarioId`, `productoId`, `entidad`, `entidadId`, `desde`, `hasta`, `pagina`, `tamano`. |
| `GET` | `/auditoria/pedidos` | 👔 | Cambios de estado de los pedidos. Filtros: `usuarioId`, `pedidoId`, `desde`, `hasta`. |

## 14. KPIs e informe en Excel

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/kpis` | 👔 | Indicadores (KPIs) de ventas, productos, pagos, horas pico, zonas, inventario y operación, en JSON. |
| `GET` | `/reportes/excel` | 👔 | Descarga el informe en Excel (`.xlsx`). |

**Parámetros de período** (ambos endpoints). Las fechas van en formato `yyyy-MM-dd`, en hora local de la tienda, y ambas son inclusive:

| Parámetro | Efecto |
| :--- | :--- |
| `tipo=diario` | El día de `desde` (hoy si no se indica). |
| `tipo=semanal` | La semana, de lunes a domingo, que contiene `desde`. |
| `tipo=mensual` | El mes que contiene `desde`. |
| `tipo=personalizado` | El rango entre `desde` y `hasta`. |
| Sin parámetros (solo `/kpis`) | El mes en curso. |

Los dos endpoints salen del mismo cálculo (`ReportesService`), así que **los datos del Excel coinciden con los de `/kpis`**. El informe trae las hojas: Resumen, Ventas por día, Productos, Categorías, Métodos de pago, Horas pico, Zonas, Inventario, Repartidores y Detalle de pedidos.

## 15. Diagnóstico — `/DbTest`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/DbTest` | 🌐 | Verifica la conexión a PostgreSQL y devuelve las migraciones aplicadas, configuración y totales de categorías y productos. Responde `503` si no hay conexión. |

## 16. Pruebas del manejo de errores — `/pruebas/errores`

Provocan una excepción a propósito para comprobar el `ExceptionMiddleware`. Todas responden con `application/problem+json` (RFC 7807).

| Método | Ruta | Acceso | Excepción | Respuesta |
| :--- | :--- | :---: | :--- | :---: |
| `GET` | `/pruebas/errores/no-encontrado` | 🌐 | `KeyNotFoundException` | `404` |
| `GET` | `/pruebas/errores/operacion-invalida` | 🌐 | `InvalidOperationException` | `400` |
| `GET` | `/pruebas/errores/interno` | 🌐 | `NullReferenceException` | `500`, sin detalles internos |

---

## Códigos de respuesta

| Código | Cuándo |
| :--- | :--- |
| `200 OK` / `201 Created` | Operación exitosa. |
| `400 Bad Request` | Datos inválidos (validaciones de los DTOs o del caso de uso, como un teléfono con formato incorrecto). |
| `401 Unauthorized` | Sin token, token vencido o usuario desactivado. |
| `403 Forbidden` | El rol del usuario no tiene permiso para ese endpoint. |
| `404 Not Found` | El recurso no existe. |
| `409 Conflict` | Duplicados (categoría o SKU repetidos), stock insuficiente o un cambio de estado que el pedido ya no admite (por ejemplo, aprobar un pedido que expiró). |
| `500 Internal Server Error` | Error no controlado. Lo responde el `ExceptionMiddleware` con un mensaje genérico, sin detalles internos. |
| `503 Service Unavailable` | `/DbTest` no pudo conectarse a la base de datos, o un servicio externo necesario para el pedido no está disponible. |

### Formato de los errores no controlados (RFC 7807)

Cualquier excepción que un controlador no maneje llega al `ExceptionMiddleware`, que responde con `Content-Type: application/problem+json`:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Recurso no encontrado",
  "status": 404,
  "detail": "No existe el producto con id 00000000-0000-0000-0000-000000000000.",
  "instance": "/pruebas/errores/no-encontrado",
  "traceId": "00-872c4b349bd0d77afcca6b30e546fd88-b8ab4b6fa809fd4f-00"
}
```

`KeyNotFoundException` → `404`, `InvalidOperationException` → `400` y cualquier otra → `500`. Detalle en [ARQUITECTURA.md](ARQUITECTURA.md#5-manejo-global-de-errores-rfc-7807).

---

## Ejemplo de uso con cURL

```bash
# 1. Iniciar sesión como gerente
curl -X POST http://localhost:5085/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"gerente@almacen.local\",\"password\":\"Cambiar123!\"}"

# 2. Usar el token devuelto para consultar el inventario
curl http://localhost:5085/inventario \
  -H "Authorization: Bearer <token>"

# 3. Reponer stock de la harina (producto sembrado)
curl -X POST http://localhost:5085/inventario/a1000000-0000-4000-8000-000000000001/reponer \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d "{\"cantidad\":20}"
```

Más peticiones de ejemplo en [`Presentation.API/Presentation.API.http`](../Presentation.API/Presentation.API.http) y en la [colección de Postman](postman/Backend_Almacen.postman_collection.json).
