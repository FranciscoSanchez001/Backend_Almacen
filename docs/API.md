# Referencia de la API

[← Volver al README](../README.md)

**URL base (desarrollo):** `http://localhost:5085`  
**Formato:** JSON (salvo la creación de pedidos, que usa `multipart/form-data` para adjuntar el comprobante).  
**Autenticación:** encabezado `Authorization: Bearer <token>`.

Los valores de las enumeraciones se envían y reciben en `snake_case` (por ejemplo, `pago_movil`, `en_camino`).

## Roles

| Símbolo | Quién puede usarlo |
| :--- | :--- |
| ![mundo](../src/frontend/public/iconos/mundo.svg) Público | Cualquiera, sin token |
| ![llave](../src/frontend/public/iconos/llave.svg) Autenticado | Cualquier usuario con sesión iniciada |
| ![carrito](../src/frontend/public/iconos/carrito.svg) Cliente | `cliente` |
| ![recibo](../src/frontend/public/iconos/recibo.svg) Personal | `ventas` (Employee) y `superadmin` (Admin) |
| ![camion](../src/frontend/public/iconos/camion.svg) Repartidor | `repartidor` (y `superadmin` donde se indica) |
| ![personal](../src/frontend/public/iconos/personal.svg) Superadmin | Solo `superadmin` (Admin) |

---

## 1. Autenticación — `/api/auth` (alias `/auth`)

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/login` | ![mundo](../src/frontend/public/iconos/mundo.svg) | Inicio de sesión del personal. Cuerpo (`LoginDto`): `{ "email", "password" }`. Devuelve `AuthResponseDto`: `{ "token", "expiraEn", "username", "email", "rol", "usuario" }`. `401` si las credenciales no son válidas. |
| `POST` | `/api/auth/google` | ![mundo](../src/frontend/public/iconos/mundo.svg) | Inicio de sesión del cliente. Cuerpo: `{ "idToken" }` (token de Google). Si el cliente no existe, se crea. |
| `GET` | `/api/auth/yo` | ![llave](../src/frontend/public/iconos/llave.svg) | Datos del usuario de la sesión actual. |

## 2. Catálogo público — `/catalogo`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/catalogo` | ![mundo](../src/frontend/public/iconos/mundo.svg) | Productos activos con stock. Filtros: `q` (texto), `categoriaId`, `ofertas` (solo los que tienen oferta vigente), `pagina`, `tamano` (24 por defecto). `precioUsd`/`precioBs` ya traen la oferta aplicada; si hay oferta vigente, `precioOriginalUsd`, `descuentoPorcentaje` y `ofertaHasta` vienen con valor (si no, en `null`). |
| `GET` | `/catalogo/{id}` | ![mundo](../src/frontend/public/iconos/mundo.svg) | Detalle de un producto. |
| `GET` | `/catalogo/inicio` | ![mundo](../src/frontend/public/iconos/mundo.svg) | Inicio personalizado: los más vendidos y, si hay sesión de cliente, sus productos frecuentes y últimas compras. Parámetro: `limite` (10 por defecto, máximo 30). |
| `GET` | `/catalogo/pago` | ![llave](../src/frontend/public/iconos/llave.svg) | Datos para pagar: cuentas de transferencia, pago móvil y wallet de Binance. |
| `GET` | `/catalogo/zonas` | ![mundo](../src/frontend/public/iconos/mundo.svg) | Zonas de entrega activas. |

## 3. Categorías — `/categorias`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/categorias` | ![mundo](../src/frontend/public/iconos/mundo.svg) | Lista de categorías. Es pública porque la tienda la usa para filtrar el catálogo. |
| `POST` | `/categorias` | ![personal](../src/frontend/public/iconos/personal.svg) | Crea una categoría. Cuerpo: `{ "nombre" }`. Responde `409` si el nombre ya existe y `403` a un Employee (ventas). |
| `PUT` | `/categorias/{id}` | ![personal](../src/frontend/public/iconos/personal.svg) | Renombra una categoría. `403` a un Employee (ventas). |

## 4. Productos — `/productos`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/productos` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Lista para el personal. Filtros: `q`, `categoriaId`, `incluirInactivos`, `pagina`, `tamano`. |
| `GET` | `/productos/{id}` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Detalle de un producto. |
| `POST` | `/productos` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Crea un producto. Cuerpo: `codigoSku`, `nombre`, `descripcion`, `precioUsd`, `costoUsd`, `imagenUrl`, `categoriaId`, `stockInicial` y, opcionales, `stockMinimo` (5), `stockMaximo` (100), `ubicacion`, `unidadMedida` (`unidad`) y la oferta: `descuentoPorcentaje` (mayor que 0 y menor que 100), `descuentoDesde`, `descuentoHasta`. Validación: precio y costo `> 0`, stocks `>= 0`, `stockMaximo > stockMinimo`, `descuentoHasta > descuentoDesde`. Queda registrado en la auditoría. |
| `PUT` | `/productos/{id}` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Edita un producto (mismos campos, con `stockDisponible` opcional en lugar de `stockInicial`). Si cambia el stock disponible, se registra como ajuste de inventario. |
| `DELETE` | `/productos/{id}` | ![personal](../src/frontend/public/iconos/personal.svg) | Borrado lógico (el producto deja de aparecer en `/catalogo`, pero se conserva su historial). Un Employee (ventas) recibe `403`. |

## 5. Inventario — `/inventario`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/inventario` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Stock disponible y reservado por producto. Filtros: `q`, `categoriaId`, `soloAgotados`. |
| `POST` | `/inventario/{productoId}/reponer` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Suma stock cuando llega mercancía. Cuerpo: `{ "cantidad" }`. |
| `GET` | `/inventario/{productoId}/movimientos` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Historial de movimientos del producto (reservas, ventas, liberaciones, reposiciones, ajustes). |

## 6. Notificaciones — `/notificaciones`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/notificaciones` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Avisos de producto agotado, pedido nuevo y pedido por expirar. Filtro: `soloNoLeidas` (verdadero por defecto). |
| `POST` | `/notificaciones/{id}/leer` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Marca una notificación como leída. |
| `POST` | `/notificaciones/leer-todas` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Marca todas como leídas. |

## 7. Pedidos — `/pedidos`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `POST` | `/pedidos` | ![carrito](../src/frontend/public/iconos/carrito.svg) | Crea un pedido y reserva el stock. **`multipart/form-data`** (ver abajo). |
| `GET` | `/pedidos/mios` | ![carrito](../src/frontend/public/iconos/carrito.svg) | Pedidos del cliente de la sesión. |
| `GET` | `/pedidos` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Bandeja del personal. Filtros: `estado`, `zonaId`, `repartidorId`, `desde`, `hasta`, `pagina`, `tamano`. Con `estado=pendiente` salen primero los más cerca de vencer. |
| `GET` | `/pedidos/repartidores` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Repartidores activos, para elegir al aprobar. |
| `GET` | `/pedidos/{id}` | ![llave](../src/frontend/public/iconos/llave.svg) | Detalle de un pedido con su historial de estados. |
| `POST` | `/pedidos/{id}/aprobar` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Aprueba y asigna repartidor. Cuerpo: `{ "repartidorId" }`. Confirma el stock. |
| `POST` | `/pedidos/{id}/rechazar` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Rechaza el pedido y libera el stock. Cuerpo opcional: `{ "motivo" }` (por defecto, "el método de pago no procede"). |
| `POST` | `/pedidos/{id}/en-camino` | ![camion](../src/frontend/public/iconos/camion.svg) ![personal](../src/frontend/public/iconos/personal.svg) | El repartidor recogió el pedido. |
| `POST` | `/pedidos/{id}/entregado` | ![camion](../src/frontend/public/iconos/camion.svg) ![personal](../src/frontend/public/iconos/personal.svg) | El pedido fue entregado (estado final). |

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
| `codigoCupon` | texto | No | Cupón de descuento. Si no aplica, `400` con el motivo; si se agotó mientras se confirmaba, `409`. |

### Cotizar el carrito — `POST /pedidos/cotizar` ![carrito](../src/frontend/public/iconos/carrito.svg)

Cuerpo: `{ "items": [{ "productoId", "cantidad" }], "codigoCupon": "VERANO10" | null }`. Devuelve lo que pagaría el cliente con los precios vigentes (ofertas incluidas) y el cupón: `lineas` (con `precioUsd`, `precioListaUsd`, `subtotalUsd` y el `stockDisponible` actual), `subtotalUsd`, `descuentoUsd`, `totalUsd`, `tasaBsUsd` y los mismos montos en Bs (en `null` si no hay tasa del día), y `cupon`. No reserva stock ni consume el cupón. Responde `400` con el motivo si el cupón no existe, no está vigente, no alcanza la compra mínima o el cliente ya lo usó.

El detalle de un pedido (`PedidoResponse`) incluye `subtotalUsd`, `subtotalBs`, `descuentoUsd`, `descuentoBs` y `codigoCupon`; cada ítem trae además `precioListaUsd` (precio sin oferta).

## 7.1 Cupones — `/cupones`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/cupones` | ![personal](../src/frontend/public/iconos/personal.svg) | Lista de cupones, los más recientes primero. Filtros: `q` (código o descripción), `activo`, `pagina`, `tamano`. Cada cupón trae `usosActuales` y `vigente`. |
| `GET` | `/cupones/{id}` | ![personal](../src/frontend/public/iconos/personal.svg) | Detalle de un cupón. |
| `POST` | `/cupones` | ![personal](../src/frontend/public/iconos/personal.svg) | Crea un cupón. Cuerpo: `codigo` (3 a 30, letras, números, `-` y `_`; se guarda en mayúsculas), `descripcion`, `tipo` (`porcentaje` o `monto_fijo`), `valor` (> 0; hasta 100 si es porcentaje) y, opcionales, `compraMinimaUsd`, `validoDesde`, `validoHasta`, `usosMaximos`, `activo` (verdadero). `409` si el código ya existe. Queda en la auditoría. |
| `PUT` | `/cupones/{id}` | ![personal](../src/frontend/public/iconos/personal.svg) | Edita un cupón (mismos campos salvo `codigo`, que no cambia). `409` si `usosMaximos` queda por debajo de los usos ya hechos. Los cupones no se borran: se desactivan con `activo: false`. |

## 8. Clientes — `/clientes`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/clientes` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Busca clientes por nombre, correo o teléfono (`buscar`). |
| `GET` | `/clientes/{id}/pedidos` | ![recibo](../src/frontend/public/iconos/recibo.svg) | Historial de compras de un cliente. |

## 9. Repartidor — `/repartidor`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/repartidor/pedidos` | ![camion](../src/frontend/public/iconos/camion.svg) | Pedidos asignados al repartidor de la sesión. |

## 10. Usuarios del personal — `/usuarios`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/usuarios` | ![personal](../src/frontend/public/iconos/personal.svg) | Lista de usuarios. Filtros: `buscar`, `rol`, `activo`, `pagina`, `tamano`. |
| `GET` | `/usuarios/{id}` | ![personal](../src/frontend/public/iconos/personal.svg) | Detalle de un usuario. |
| `POST` | `/usuarios` | ![personal](../src/frontend/public/iconos/personal.svg) | Crea un usuario de ventas o repartidor. Cuerpo: `nombre`, `email`, `telefono`, `rol`, `password` (8 a 72 caracteres). |
| `PUT` | `/usuarios/{id}` | ![personal](../src/frontend/public/iconos/personal.svg) | Edita un usuario. |
| `POST` | `/usuarios/{id}/activar` | ![personal](../src/frontend/public/iconos/personal.svg) | Reactiva un usuario. |
| `POST` | `/usuarios/{id}/desactivar` | ![personal](../src/frontend/public/iconos/personal.svg) | Desactiva un usuario; pierde el acceso de inmediato. |

## 11. Configuración — `/configuracion`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/configuracion` | ![personal](../src/frontend/public/iconos/personal.svg) | Parámetros actuales del sistema. |
| `PUT` | `/configuracion` | ![personal](../src/frontend/public/iconos/personal.svg) | Actualiza número de soporte, horas de expiración (1 a 168), datos de transferencia, pago móvil, wallet de Binance y números de prueba de WhatsApp (hasta 20). |
| `PUT` | `/configuracion/tasa` | ![personal](../src/frontend/public/iconos/personal.svg) | Carga la **tasa Bs/USD del día**. Cuerpo: `{ "tasa" }`. Queda en el historial. **Es necesaria para que los clientes puedan crear pedidos.** |
| `GET` | `/configuracion/tasas` | ![personal](../src/frontend/public/iconos/personal.svg) | Historial de tasas cargadas. |

## 12. Zonas de entrega — `/zonas`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/zonas` | ![personal](../src/frontend/public/iconos/personal.svg) | Todas las zonas, activas e inactivas. |
| `POST` | `/zonas` | ![personal](../src/frontend/public/iconos/personal.svg) | Crea una zona. |
| `PUT` | `/zonas/{id}` | ![personal](../src/frontend/public/iconos/personal.svg) | Edita o desactiva una zona. |

## 13. Auditoría — `/auditoria`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/auditoria` | ![personal](../src/frontend/public/iconos/personal.svg) | Cambios registrados. Filtros: `usuarioId`, `productoId`, `entidad`, `entidadId`, `desde`, `hasta`, `pagina`, `tamano`. |
| `GET` | `/auditoria/pedidos` | ![personal](../src/frontend/public/iconos/personal.svg) | Cambios de estado de los pedidos. Filtros: `usuarioId`, `pedidoId`, `desde`, `hasta`. |

## 14. KPIs e informe en Excel

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/kpis` | ![personal](../src/frontend/public/iconos/personal.svg) | Indicadores (KPIs) de ventas, productos, pagos, horas pico, zonas, inventario y operación, en JSON. |
| `GET` | `/reportes/excel` | ![personal](../src/frontend/public/iconos/personal.svg) | Descarga el informe en Excel (`.xlsx`). |
| `GET` | `/reportes/pdf` | ![personal](../src/frontend/public/iconos/personal.svg) | Descarga el dashboard KPI en PDF (KPIs y comportamiento de los visitantes, mismo período). |

**Parámetros de período** (ambos endpoints). Las fechas van en formato `yyyy-MM-dd`, en hora local de la tienda, y ambas son inclusive:

| Parámetro | Efecto |
| :--- | :--- |
| `tipo=diario` | El día de `desde` (hoy si no se indica). |
| `tipo=semanal` | La semana, de lunes a domingo, que contiene `desde`. |
| `tipo=mensual` | El mes que contiene `desde`. |
| `tipo=personalizado` | El rango entre `desde` y `hasta`. |
| Sin parámetros (solo `/kpis`) | El mes en curso. |

Los dos endpoints salen del mismo cálculo (`ReportesService`), así que **los datos del Excel coinciden con los de `/kpis`**. El informe trae las hojas: Resumen, Ventas por día, Productos, Categorías, Métodos de pago, Horas pico, Zonas, Inventario, Repartidores y Detalle de pedidos.

## 14.1 Analítica de comportamiento — `/analitica`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `POST` | `/analitica/eventos` | ![mundo](../src/frontend/public/iconos/mundo.svg) | Lote de eventos de la tienda. Cuerpo: `{ "sesionId", "eventos": [{ "tipo", "ruta", "productoId", "categoriaId", "texto", "cantidad", "valor" }] }` (1 a 50 eventos; `sesionId` de 8 a 64 caracteres). Tipos: `pagina_vista`, `filtro_categoria`, `filtro_ofertas`, `abrir_carrito`, `agregar_carrito`, `quitar_carrito`, `inicio_checkout`, `cupon_aplicado`, `cupon_rechazado`, `pedido_confirmado` (`busqueda` no: la registra `/catalogo`). Responde `204`; los lotes del personal se descartan. Límite: 60 lotes por minuto por IP (`429`). |
| `GET` | `/analitica/comportamiento` | ![personal](../src/frontend/public/iconos/personal.svg) | Resumen del período (mismos parámetros que `/kpis`: `tipo`, `desde`, `hasta`): visitas, búsquedas y % sin resultados, conversión, embudo, lo más buscado, lo buscado sin resultados, productos agregados al carrito vs. vendidos, categorías, cupones y actividad por día. |

`GET /catalogo` con `q` registra la búsqueda (y cuántos resultados dio) si la petición trae el encabezado `X-Sesion-Analitica` con el id de la visita. Solo cuenta la primera página.

## 15. Diagnóstico — `/DbTest`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/DbTest` | ![personal](../src/frontend/public/iconos/personal.svg) | Verifica la conexión a PostgreSQL y devuelve las migraciones aplicadas, configuración y totales de categorías y productos. Responde `503` si no hay conexión. |

## 16. Pruebas del manejo de errores — `/pruebas/errores`

Provocan una excepción a propósito para comprobar el `ExceptionMiddleware`. Todas responden con `application/problem+json` (RFC 7807).

| Método | Ruta | Acceso | Excepción | Respuesta |
| :--- | :--- | :---: | :--- | :---: |
| `GET` | `/pruebas/errores/no-encontrado` | ![personal](../src/frontend/public/iconos/personal.svg) | `KeyNotFoundException` | `404` |
| `GET` | `/pruebas/errores/operacion-invalida` | ![personal](../src/frontend/public/iconos/personal.svg) | `InvalidOperationException` | `400` |
| `GET` | `/pruebas/errores/interno` | ![personal](../src/frontend/public/iconos/personal.svg) | `NullReferenceException` | `500`, sin detalles internos |

---

## Códigos de respuesta

| Código | Cuándo |
| :--- | :--- |
| `200 OK` / `201 Created` | Operación exitosa. |
| `400 Bad Request` | Datos inválidos: reglas de FluentValidation sobre los DTOs (con el detalle por campo en `errors`) o del caso de uso. |
| `401 Unauthorized` | Sin token, token vencido o usuario desactivado (Problem Details). |
| `403 Forbidden` | El rol del usuario no tiene permiso para ese endpoint (Problem Details). |
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

`ValidationException` e `InvalidOperationException` → `400`, `KeyNotFoundException` → `404`, `ConflictoException` → `409` y cualquier otra → `500`. Detalle en [ARQUITECTURA.md](ARQUITECTURA.md#5-manejo-global-de-errores-rfc-7807).

---

## Ejemplo de uso con cURL

```bash
# 1. Iniciar sesión como gerente
curl -X POST http://localhost:5085/api/auth/login \
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

Más peticiones de ejemplo en [`src/backend/Presentation.API/Presentation.API.http`](../src/backend/Presentation.API/Presentation.API.http) y en la [colección de Postman](postman/Backend_Almacen.postman_collection.json).
