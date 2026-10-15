# Reglas de Negocio

[← Volver al README](../README.md)

Este documento describe cómo se comporta el sistema y dónde vive cada regla en el código.

---

## 1. Roles y Permisos

| Acción | Cliente | Repartidor | Ventas | Superadmin |
| :--- | :---: | :---: | :---: | :---: |
| Ver catálogo y comprar | ![correcto](../src/frontend/public/iconos/correcto.svg) | — | — | — |
| Aprobar o rechazar pedidos | — | — | ![correcto](../src/frontend/public/iconos/correcto.svg) | ![correcto](../src/frontend/public/iconos/correcto.svg) |
| Asignar repartidor | — | — | ![correcto](../src/frontend/public/iconos/correcto.svg) | ![correcto](../src/frontend/public/iconos/correcto.svg) |
| Marcar "en camino" o "entregado" | — | ![correcto](../src/frontend/public/iconos/correcto.svg) (solo sus pedidos) | — | ![correcto](../src/frontend/public/iconos/correcto.svg) |
| Crear y editar productos y stock | — | — | ![correcto](../src/frontend/public/iconos/correcto.svg) (queda auditado) | ![correcto](../src/frontend/public/iconos/correcto.svg) |
| **Borrar** productos | — | — | ![cerrar](../src/frontend/public/iconos/cerrar.svg) | ![correcto](../src/frontend/public/iconos/correcto.svg) |
| Ver historial de compras de un cliente | — | — | ![correcto](../src/frontend/public/iconos/correcto.svg) | ![correcto](../src/frontend/public/iconos/correcto.svg) |
| Gestionar usuarios del personal y configuración | — | — | — | ![correcto](../src/frontend/public/iconos/correcto.svg) |

- El **personal** inicia sesión con correo y contraseña; los **clientes**, con Google.
- Si un usuario se **desactiva**, pierde el acceso de inmediato aunque su token siga vigente.

---

## 2. Ciclo de Vida del Pedido

```
Cliente confirma el pedido  (se reserva el stock)
        │
        ▼
    PENDIENTE ──── 5 horas sin revisar ────► EXPIRADO   (stock liberado)
        │
        ├── Ventas rechaza ──► RECHAZADO                 (stock liberado)
        │
        └── Ventas aprueba y asigna repartidor           (stock confirmado + WhatsApp)
                │
                ▼
            ASIGNADO ──► EN CAMINO ──► ENTREGADO         (WhatsApp al salir en camino)
```

**Transiciones permitidas** (`Core.Domain/Reglas/TransicionesPedido.cs`):

| Desde | Hacia |
| :--- | :--- |
| `pendiente` | `aprobado`, `rechazado`, `expirado` |
| `aprobado` | `asignado` |
| `asignado` | `en_camino` |
| `en_camino` | `entregado` |

- Cualquier otro cambio se rechaza. Toda transición pasa por `Pedido.CambiarEstado(...)`, que además registra la línea en `historial_estados_pedido` con el usuario que la hizo (o `null` si fue el sistema).
- **Aprobar exige elegir un repartidor**: el pedido pasa por `aprobado` y `asignado` en la misma operación.
- **Entregado es el estado final.** El cliente recibe un mensaje con el número de soporte por si hubo algún problema.
- Cuentan como **venta** (para KPIs e informes) los pedidos en `aprobado`, `asignado`, `en_camino` y `entregado`.

---

## 3. Creación del Pedido

Al confirmar la compra, el cliente envía (`POST /pedidos`):

- Productos y cantidades.
- **Método de pago:** transferencia o pago móvil (en bolívares) o Binance (en USDT, 1:1 con el dólar).
- **Referencia** del pago y **captura** del comprobante (obligatorias).
- **Zona**, dirección con punto de referencia y, opcionalmente, coordenadas.
- **Teléfono venezolano obligatorio** (`+58 4XX XXX XXXX`), validado en `Core.Domain/Reglas/Telefonos.cs`. Se guarda en el pedido, porque el cliente puede comprar para otra persona.
- **Cupón** de descuento, opcional (ver sección 10).

Antes de confirmar, el checkout consulta `POST /pedidos/cotizar`, que calcula el total con los mismos precios, ofertas y cupón que usará la creación. El precio nunca sale del navegador.

El sistema entonces:
1. Verifica que haya **tasa del día** cargada. Si no la hay, el pedido no se crea.
2. **Congela** la tasa de cambio, el precio de cada producto (USD y Bs, **ya con la oferta vigente**), su precio de lista y su categoría.
3. Si hay cupón, verifica que aplique y **congela el descuento** (USD y Bs). Total = subtotal − descuento.
4. **Reserva el stock** de todos los productos (ver sección 4) y, después, **un uso del cupón**. Si algo no alcanza, el pedido no se crea.
5. Fija la fecha de vencimiento: `expira_en = creado_en + horas_expiracion` (5 horas por defecto).
6. Crea una notificación de **pedido nuevo** para el personal.

---

## 4. Inventario y Reserva de Stock

Cada producto tiene dos contadores: **stock disponible** (lo que se puede vender) y **stock reservado** (lo apartado por pedidos pendientes). Lo implementa `Core.Application/Servicios/InventarioService.cs`.

| Momento | Disponible | Reservado | Movimiento registrado |
| :--- | :---: | :---: | :--- |
| El cliente crea el pedido | − cantidad | + cantidad | `reserva` |
| Ventas **aprueba** | sin cambio | − cantidad | `venta` |
| Ventas **rechaza** o el pedido **expira** | + cantidad | − cantidad | `liberacion` |
| Llega mercancía (**reponer**) | + cantidad | sin cambio | `reposicion` |
| Se corrige el stock al editar un producto | nuevo valor | sin cambio | `ajuste` |

Reglas:
- **Sin sobreventa.** La reserva es atómica y la base de datos impide que el stock quede negativo, así que si dos clientes compran la última unidad al mismo tiempo, solo uno lo consigue.
- **Todo o nada.** Si un pedido tiene varios productos y uno no alcanza, no se reserva ninguno.
- **Agotado.** Cuando el stock disponible llega a 0, se crea una notificación de **producto agotado** y el producto deja de aparecer en `/catalogo`. Si una reposición, un rechazo o una expiración devuelven unidades, vuelve a aparecer solo.
- **Trazabilidad.** Cada movimiento guarda la cantidad, el stock antes y después, el pedido (si aplica) y el usuario.

---

## 5. Expiración Automática

- Un servicio en segundo plano (`Infrastructure/Jobs/ExpiracionPedidosJob.cs`) revisa los pedidos **cada 5 minutos**.
- Todo pedido `pendiente` cuya fecha `expira_en` ya pasó se marca como **expirado**, se **libera su stock** y se envía el mensaje de expiración al cliente.
- **Una hora antes** de vencer, se crea una notificación de **pedido por expirar** para que el personal lo revise a tiempo.
- El intervalo y la anticipación del aviso se configuran en la sección `Expiracion` de la configuración; las horas de expiración, en la tabla `configuracion`.

---

## 6. Moneda y Tasa de Cambio

- La moneda oficial es el **dólar (USD)**: los precios se guardan en USD.
- El gerente carga la **tasa Bs/USD del día** con `PUT /configuracion/tasa`; cada carga queda en `historial_tasas`.
- **Sin tasa cargada, la tienda no acepta pedidos**, porque no puede calcular el total en bolívares.
- `/catalogo` devuelve cada precio en USD y en Bs, calculado con la tasa vigente.
- Cada pedido **congela la tasa** al momento de la compra, así que los cambios posteriores de tasa no alteran pedidos ya hechos.

---

## 7. Notificaciones por WhatsApp

Los mensajes se generan en `Core.Application/Servicios/ColaWhatsapp.cs` y los envía `Infrastructure/Mensajeria/EnvioWhatsappWorker.cs` a través del servicio de **Baileys** (`src/whatsapp`, `POST {ServicioUrl}/enviar`).

**Vincular el teléfono.** El gerente entra a **Administración > WhatsApp**, pulsa *Vincular teléfono* y escanea el código QR desde WhatsApp > *Dispositivos vinculados*. La sesión queda guardada en el volumen `whatsapp_sesion`, así que no hay que volver a escanear al reiniciar. Desde esa pantalla también se envía un mensaje de prueba y se revisan los últimos mensajes con su estado.

Para no abrumar al cliente, solo recibe **dos mensajes**:

| Evento | Mensaje |
| :--- | :--- |
| Aprobado | "¡Hola {nombre}! Tu compra #{número} por ${total USD} (Bs {total Bs}) fue aprobada y será enviada a: {dirección}, {zona}." |
| En camino | "Tu pedido #{número} ya va en camino." |

El rechazo, la expiración y la entrega no se notifican por WhatsApp; el cliente ve el estado en **Mis pedidos**.

Reglas:
- **Lista blanca de pruebas.** Solo se envía a los números registrados en `configuracion.numeros_prueba`; los demás quedan registrados como `bloqueado_lista_blanca`.
- **De a uno.** Los mensajes salen uno por uno, con 60 segundos entre cada envío (`Whatsapp:SegundosEntreEnvios`), para que el número de la tienda no mande ráfagas y WhatsApp no lo bloquee. Los que esperan turno están en una cola en memoria: si la API se reinicia en ese momento, se pierden.
- **Registro.** Cada intento queda en `mensajes_whatsapp` con su estado (`enviado`, `error` o `bloqueado_lista_blanca`).
- **Un fallo de WhatsApp no afecta al pedido.** Los mensajes van por una cola en segundo plano; si el envío falla, el cambio de estado del pedido ya quedó guardado.
- Si la sección `Whatsapp` de la configuración está vacía, los mensajes no se envían.

---

## 8. KPIs e Informe en Excel

- Solo el **superadmin** accede a los KPIs (`GET /kpis`) y a los informes (`GET /reportes/excel` y `GET /reportes/pdf`). El PDF trae los mismos KPIs de la pantalla más el comportamiento de los visitantes.
- **Solo cuentan como venta** los pedidos `aprobado`, `asignado`, `en_camino` y `entregado`. Los pendientes, rechazados y expirados no suman a los ingresos.
- Los montos están en USD, con su equivalente en Bs según la tasa congelada de cada pedido.
- Los **ingresos totales** (por día, método de pago y zona) usan el total del pedido, que ya descuenta el cupón. Los ingresos **por producto y categoría** usan el precio de cada ítem (con la oferta, sin prorratear el cupón), así que su suma puede superar el total cuando hubo cupones.
- El período puede ser diario, semanal (lunes a domingo), mensual o personalizado, en hora local de la tienda.
- Los KPIs y el Excel salen del mismo cálculo (`ReportesService`), así que siempre coinciden.
- El informe trae 10 hojas: Resumen, Ventas por día, Productos, Categorías, Métodos de pago, Horas pico, Zonas, Inventario, Repartidores y Detalle de pedidos. La hoja **Detalle de pedidos** trae los datos sin procesar, para que el gerente haga sus propios análisis.

---

## 9. Auditoría

- Cada creación, edición o borrado de productos queda registrado en `auditoria`, con el usuario, la fecha y los datos **antes y después** en JSON.
- Cada cambio de stock queda en `movimientos_inventario` (ver sección 4), también con el usuario que lo hizo.
- El personal de ventas **no puede borrar** productos; el borrado es **lógico** (el producto se marca inactivo y se conserva el historial de ventas).

---

## 10. Ofertas y Cupones

### Ofertas de producto

- Cada producto puede tener un **% de descuento** (mayor que 0 y menor que 100) con fechas de inicio y fin **opcionales**. Sin fechas, la oferta aplica mientras tenga porcentaje. La vigencia es `[desde, hasta)`; en el panel se eligen días y "hasta" es inclusive.
- Lo configuran ventas y el gerente al editar el producto; el cambio queda en la auditoría.
- `/catalogo` devuelve el precio **ya rebajado** y, si la oferta está vigente, el precio original para mostrarlo tachado. `?ofertas=true` lista solo los productos en oferta.
- La regla vive en `Producto.PrecioVigenteUsd(...)` (`Core.Domain/Entidades/Producto.cs`).

### Cupones

- Los crea y edita **solo el gerente** (`/admin/cupones`), porque afectan los ingresos. No se borran: se desactivan.
- Tipos: **porcentaje** (hasta 100 %) o **monto fijo** en USD. El descuento nunca deja el total por debajo de 0.
- Se aplican al **subtotal del pedido ya con las ofertas** (se acumulan con ellas).
- Condiciones opcionales: **compra mínima** (sobre ese subtotal), **vigencia** y **límite de usos** entre todos los clientes.
- **Un uso por cliente.** Los pedidos rechazados o expirados no cuentan: al rechazarse o expirar, el uso se devuelve y el cliente puede volver a usarlo.
- **Sin sobreuso.** El uso se descuenta con un `UPDATE` condicional dentro de la transacción del pedido, y la base impide pasar del límite (`ck_cupones_usos`) y repetir cupón por cliente (`ux_pedidos_cupon_cliente_vigente`). Si dos pedidos compiten por el último uso, solo uno lo consigue.
- Reglas en `Cupon.MotivoNoAplicable(...)` y `Cupon.CalcularDescuento(...)` (`Core.Domain/Entidades/Cupon.cs`); el flujo, en `PedidosService`.

---

## 11. Analítica de Comportamiento

El gerente ve en `/admin/comportamiento` qué hacen los visitantes de la tienda: qué buscan, qué no encuentran, qué agregan al carrito y en qué paso abandonan la compra.

**Qué se registra** (tabla `eventos_analitica`):

| Evento | Quién lo registra | Datos |
| :--- | :--- | :--- |
| Búsqueda | La API, al responder `/catalogo?q=` (solo la primera página) | Texto normalizado y cantidad de resultados |
| Página vista | El navegador | Ruta de la tienda |
| Filtro por categoría / ofertas | El navegador | Categoría |
| Abrir carrito, agregar y quitar productos | El navegador | Producto y unidades |
| Inicio del pago, cupón aplicado o rechazado | El navegador | Código del cupón |
| Pedido confirmado | El navegador | Total en USD |

**Privacidad:**
- Es **anónimo**: cada visita tiene un id aleatorio que el navegador renueva tras **30 minutos sin actividad**. No se guarda la IP ni datos personales; si el visitante inició sesión con Google, el evento queda asociado a su cuenta.
- Se respeta **"No rastrear"** (Do Not Track): el navegador no envía nada.
- El **personal** no se cuenta, aunque navegue la tienda.
- Los eventos se **borran solos** a los 180 días (`Analitica:DiasRetencion`, job `LimpiezaAnaliticaJob`).

**Cómo leer el resumen:**
- **Visitas**: sesiones distintas con al menos un evento. **Conversión**: % de visitas con un pedido confirmado.
- **Embudo**: visitaron → agregaron al carrito → iniciaron el pago → confirmaron el pedido, en sesiones.
- **Agregados vs. vendidos**: unidades agregadas al carrito frente a unidades vendidas (pedidos que son venta) en el mismo período.
- Los eventos llegan por lotes cada pocos segundos; un fallo de la analítica **nunca** afecta a la compra.
- Las cifras son aproximadas: bloqueadores de anuncios o pestañas cerradas de golpe pueden perder eventos. Para las ventas reales, la fuente es el dashboard KPI.
