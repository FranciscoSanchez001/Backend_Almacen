# Reglas de Negocio

[← Volver al README](../README.md)

Este documento describe cómo se comporta el sistema y dónde vive cada regla en el código.

---

## 1. Roles y Permisos

| Acción | Cliente | Repartidor | Ventas | Superadmin |
| :--- | :---: | :---: | :---: | :---: |
| Ver catálogo y comprar | ✅ | — | — | — |
| Aprobar o rechazar pedidos | — | — | ✅ | ✅ |
| Asignar repartidor | — | — | ✅ | ✅ |
| Marcar "en camino" o "entregado" | — | ✅ (solo sus pedidos) | — | ✅ |
| Crear y editar productos y stock | — | — | ✅ (queda auditado) | ✅ |
| **Borrar** productos | — | — | ❌ | ✅ |
| Ver historial de compras de un cliente | — | — | ✅ | ✅ |
| Gestionar usuarios del personal y configuración | — | — | — | ✅ |

- El **personal** inicia sesión con correo y contraseña; los **clientes**, con Google.
- Si un usuario se **desactiva**, pierde el acceso de inmediato aunque su token siga vigente.

---

## 2. Ciclo de Vida del Pedido

```
Cliente confirma el pedido  (se reserva el stock)
        │
        ▼
    PENDIENTE ──── 5 horas sin revisar ────► EXPIRADO   (stock liberado + WhatsApp)
        │
        ├── Ventas rechaza ──► RECHAZADO                 (stock liberado + WhatsApp)
        │
        └── Ventas aprueba y asigna repartidor           (stock confirmado)
                │
                ▼
            ASIGNADO ──► EN CAMINO ──► ENTREGADO         (WhatsApp en cada paso)
```

**Transiciones permitidas** (`Domain/Reglas/TransicionesPedido.cs`):

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
- **Teléfono venezolano obligatorio** (`+58 4XX XXX XXXX`), validado en `Domain/Reglas/Telefonos.cs`. Se guarda en el pedido, porque el cliente puede comprar para otra persona.

El sistema entonces:
1. Verifica que haya **tasa del día** cargada. Si no la hay, el pedido no se crea.
2. **Congela** la tasa de cambio, el precio de cada producto (USD y Bs) y su categoría.
3. **Reserva el stock** de todos los productos (ver sección 4). Si alguno no alcanza, el pedido no se crea.
4. Fija la fecha de vencimiento: `expira_en = creado_en + horas_expiracion` (5 horas por defecto).
5. Crea una notificación de **pedido nuevo** para el personal.

---

## 4. Inventario y Reserva de Stock

Cada producto tiene dos contadores: **stock disponible** (lo que se puede vender) y **stock reservado** (lo apartado por pedidos pendientes). Lo implementa `Application/Servicios/InventarioService.cs`.

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
- **Agotado.** Cuando el stock disponible llega a 0, se crea una notificación de **producto agotado** y el producto deja de mostrarse en el catálogo. Si una reposición, un rechazo o una expiración devuelven unidades, vuelve a aparecer solo.
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
- El catálogo muestra cada precio en USD y en Bs, calculado con la tasa vigente.
- Cada pedido **congela la tasa** al momento de la compra, así que los cambios posteriores de tasa no alteran pedidos ya hechos.

---

## 7. Notificaciones por WhatsApp

Los mensajes se generan en `Application/Servicios/ColaWhatsapp.cs` y los envía `Infrastructure/Mensajeria/EnvioWhatsappWorker.cs` a través del microservicio de **Baileys** (`POST {ServicioUrl}/enviar`).

| Evento | Mensaje |
| :--- | :--- |
| Aprobado | "¡Hola {nombre}! Tu compra #{número} por ${total USD} (Bs {total Bs}) fue aprobada y será enviada a: {dirección}, {zona}." |
| Rechazado | "Hola {nombre}, tu compra #{número} fue rechazada porque {motivo}. Si crees que es un error, escríbenos al {soporte}." |
| Expirado | "Hola {nombre}, tu pedido #{número} no pudo ser procesado a tiempo y fue cancelado. Si ya realizaste el pago, comunícate al {soporte}." |
| En camino | "Tu pedido #{número} ya va en camino." |
| Entregado | "Tu pedido #{número} fue entregado. Si no llegó o no llegó en buen estado, comunícate al {soporte}." |

Reglas:
- **Lista blanca de pruebas.** Solo se envía a los números registrados en `configuracion.numeros_prueba`; los demás quedan registrados como `bloqueado_lista_blanca`.
- **Registro.** Cada intento queda en `mensajes_whatsapp` con su estado (`enviado`, `error` o `bloqueado_lista_blanca`).
- **Un fallo de WhatsApp no afecta al pedido.** Los mensajes van por una cola en segundo plano; si el envío falla, el cambio de estado del pedido ya quedó guardado.
- Si la sección `Whatsapp` de la configuración está vacía, los mensajes no se envían.

---

## 8. KPIs e Informe en Excel

- Solo el **superadmin** accede al dashboard (`GET /kpis`) y al informe (`GET /reportes/excel`).
- **Solo cuentan como venta** los pedidos `aprobado`, `asignado`, `en_camino` y `entregado`. Los pendientes, rechazados y expirados no suman a los ingresos.
- Los montos están en USD, con su equivalente en Bs según la tasa congelada de cada pedido.
- El período puede ser diario, semanal (lunes a domingo), mensual o personalizado, en hora local de la tienda.
- El dashboard y el Excel salen del mismo cálculo (`ReportesService`), así que siempre coinciden.
- El informe trae 10 hojas: Resumen, Ventas por día, Productos, Categorías, Métodos de pago, Horas pico, Zonas, Inventario, Repartidores y Detalle de pedidos. La hoja **Detalle de pedidos** trae los datos sin procesar, para que el gerente haga sus propios análisis.

---

## 9. Auditoría

- Cada creación, edición o borrado de productos queda registrado en `auditoria`, con el usuario, la fecha y los datos **antes y después** en JSON.
- Cada cambio de stock queda en `movimientos_inventario` (ver sección 4), también con el usuario que lo hizo.
- El personal de ventas **no puede borrar** productos; el borrado es **lógico** (el producto se marca inactivo y se conserva el historial de ventas).
