# Modelo de Datos

[← Volver al README](../README.md)

La base de datos es **PostgreSQL 16** y se genera con **Entity Framework Core 10 (Code-First)**. La configuración de cada tabla está en `Infrastructure/Persistencia/Configuraciones/` (Fluent API) y el script completo en [`database/InitialCreate.sql`](../database/InitialCreate.sql).

Convenciones:
- **Entidad base:** todas las entidades heredan de `BaseEntity` (`Core.Domain/Comun/BaseEntity.cs`), que define `Id` (`Guid`) y `CreatedAt` (`DateTime` en UTC). Por eso **todas las tablas** tienen `id` y `creado_en`.
- **Claves primarias UUID** en todas las tablas.
- **Fechas en UTC** (`timestamp with time zone`). `CreatedAt` se guarda en la columna `creado_en`, con `now()` por defecto; ese mapeo se configura una sola vez para todas las entidades en `ApplicationDbContext`.
- **Nombres en `snake_case`** (por ejemplo, la propiedad `StockDisponible` se guarda en la columna `stock_disponible`).
- **Montos** con precisión `numeric(18,2)` y tasas de cambio con `numeric(18,4)`.
- Las enumeraciones se guardan como **tipos enum nativos de PostgreSQL**.

---

## 1. Diagrama Entidad-Relación

```mermaid
erDiagram
    CATEGORIAS ||--o{ PRODUCTOS : "clasifica"
    USUARIOS ||--o{ PRODUCTOS : "crea"
    USUARIOS ||--o{ PEDIDOS : "compra (cliente)"
    USUARIOS ||--o{ PEDIDOS : "revisa (ventas)"
    USUARIOS ||--o{ PEDIDOS : "entrega (repartidor)"
    ZONAS ||--o{ PEDIDOS : "zona de entrega"
    PEDIDOS ||--|{ PEDIDO_ITEMS : "contiene"
    PRODUCTOS ||--o{ PEDIDO_ITEMS : "vendido en"
    CATEGORIAS ||--o{ PEDIDO_ITEMS : "categoria congelada"
    PEDIDOS ||--o{ HISTORIAL_ESTADOS_PEDIDO : "registra"
    USUARIOS ||--o{ HISTORIAL_ESTADOS_PEDIDO : "hace el cambio"
    PRODUCTOS ||--o{ MOVIMIENTOS_INVENTARIO : "mueve"
    PEDIDOS ||--o{ MOVIMIENTOS_INVENTARIO : "origina"
    USUARIOS ||--o{ MOVIMIENTOS_INVENTARIO : "registra"
    PRODUCTOS ||--o{ NOTIFICACIONES : "agotado"
    PEDIDOS ||--o{ NOTIFICACIONES : "nuevo o por expirar"
    PEDIDOS ||--o{ MENSAJES_WHATSAPP : "notifica"
    USUARIOS ||--o{ AUDITORIA : "realiza"
    USUARIOS ||--o{ HISTORIAL_TASAS : "carga"

    CATEGORIAS {
        uuid id PK
        varchar_100 nombre UK
        timestamptz creado_en
    }
    ZONAS {
        uuid id PK
        varchar nombre UK
        boolean activa
        timestamptz creado_en
    }
    USUARIOS {
        uuid id PK
        varchar_150 nombre
        varchar_254 email UK
        varchar_20 telefono
        rol_usuario rol
        varchar_255 google_id UK "Solo clientes"
        varchar_100 password_hash "Solo personal"
        boolean activo
        timestamptz creado_en
    }
    PRODUCTOS {
        uuid id PK
        varchar_30 codigo_sku UK
        varchar_200 nombre
        varchar_1000 descripcion
        numeric_18_2 precio_usd
        numeric_18_2 costo_usd
        varchar_500 imagen_url
        uuid categoria_id FK
        int stock_disponible
        int stock_reservado
        boolean activo
        uuid creado_por_id FK
        timestamptz creado_en
        timestamptz actualizado_en
    }
    PEDIDOS {
        uuid id PK
        int numero UK "Identity"
        uuid cliente_id FK
        estado_pedido estado
        metodo_pago metodo_pago
        moneda_pago moneda_pago
        numeric_18_4 tasa_cambio
        numeric_18_2 total_usd
        numeric_18_2 total_bs
        varchar_100 referencia_pago
        varchar_500 captura_url
        uuid zona_id FK
        varchar_500 direccion_texto
        float latitud
        float longitud
        varchar_20 telefono_contacto
        uuid revisado_por_id FK
        timestamptz revisado_en
        varchar_300 motivo_rechazo
        uuid repartidor_id FK
        timestamptz asignado_en
        timestamptz en_camino_en
        timestamptz entregado_en
        timestamptz expira_en
        timestamptz creado_en
    }
    PEDIDO_ITEMS {
        uuid id PK
        uuid pedido_id FK
        uuid producto_id FK
        uuid categoria_id FK
        int cantidad
        numeric_18_2 precio_usd
        numeric_18_2 precio_bs
        timestamptz creado_en
    }
    HISTORIAL_ESTADOS_PEDIDO {
        uuid id PK
        uuid pedido_id FK
        estado_pedido estado_anterior
        estado_pedido estado_nuevo
        uuid usuario_id FK "Null si fue el sistema"
        timestamptz creado_en
    }
    MOVIMIENTOS_INVENTARIO {
        uuid id PK
        uuid producto_id FK
        uuid pedido_id FK
        uuid usuario_id FK
        tipo_movimiento_inventario tipo
        int cantidad
        int disponible_antes
        int disponible_despues
        timestamptz creado_en
    }
    NOTIFICACIONES {
        uuid id PK
        tipo_notificacion tipo
        uuid producto_id FK
        uuid pedido_id FK
        boolean leida
        timestamptz creado_en
    }
    MENSAJES_WHATSAPP {
        uuid id PK
        uuid pedido_id FK
        varchar_20 telefono
        varchar_50 plantilla
        varchar_1000 texto
        estado_mensaje_whatsapp estado
        varchar_2000 error
        timestamptz creado_en
    }
    AUDITORIA {
        uuid id PK
        uuid usuario_id FK
        varchar_50 entidad
        uuid entidad_id
        accion_auditoria accion
        jsonb datos_antes
        jsonb datos_despues
        timestamptz creado_en
    }
    CONFIGURACION {
        uuid id PK "Una sola fila"
        numeric_18_4 tasa_bs_usd
        varchar_20 numero_soporte
        int horas_expiracion
        varchar_1000 datos_transferencia
        varchar_1000 datos_pago_movil
        varchar_200 wallet_binance
        text_array numeros_prueba
        timestamptz creado_en
    }
    HISTORIAL_TASAS {
        uuid id PK
        numeric_18_4 tasa
        uuid usuario_id FK
        timestamptz creado_en
    }
```

---

## 2. Descripción de las Tablas

| Tabla | Para qué sirve |
| :--- | :--- |
| `categorias` | Secciones del supermercado (Víveres, Bebidas…). |
| `productos` | Catálogo. Guarda el stock en dos contadores: **disponible** (lo que se puede vender) y **reservado** (lo apartado por pedidos pendientes). El borrado es lógico con `activo`. |
| `usuarios` | Clientes y personal. Los clientes tienen `google_id`; el personal, `password_hash`. |
| `zonas` | Zonas de entrega; cada pedido indica la suya. |
| `pedidos` | Cada compra, con su estado, método de pago, comprobante, dirección, tasa de cambio congelada y fechas de cada etapa. |
| `pedido_items` | Productos de cada pedido, con **precio y categoría congelados** al momento de la compra. |
| `historial_estados_pedido` | Cada cambio de estado de un pedido: de qué estado a cuál, quién y cuándo. |
| `movimientos_inventario` | Cada entrada o salida de stock: reservas, ventas, liberaciones, reposiciones y ajustes. |
| `notificaciones` | Avisos para el personal: producto agotado, pedido nuevo y pedido por expirar. |
| `mensajes_whatsapp` | Registro de cada mensaje enviado (o bloqueado) al cliente. |
| `auditoria` | Quién cambió qué registro, con los datos antes y después en JSON. |
| `configuracion` | Parámetros del sistema: tasa del día, número de soporte, horas de expiración, datos de pago y números de prueba. |
| `historial_tasas` | Cada tasa de cambio cargada, con el usuario y la fecha. |

---

## 3. Restricciones de Integridad

Además de las claves foráneas, la base de datos protege las reglas del negocio con restricciones `CHECK` e índices únicos:

| Tabla | Restricción | Regla |
| :--- | :--- | :--- |
| `productos` | `precio_usd >= 0`, `costo_usd >= 0` | No hay precios negativos. |
| `productos` | `stock_disponible >= 0`, `stock_reservado >= 0` | El stock nunca queda negativo, incluso si dos compras llegan a la vez. |
| `productos` | `codigo_sku` único | No se repiten códigos. |
| `usuarios` | `ck_usuarios_credenciales` | Un cliente debe tener `google_id`; el personal debe tener `password_hash`. |
| `usuarios` | `email` y `google_id` únicos | Una cuenta por correo. |
| `pedidos` | `total_usd >= 0`, `total_bs >= 0`, `tasa_cambio > 0` | Totales y tasa válidos. |
| `pedidos` | `numero` único (columna *identity*) | Número correlativo legible (#1, #2…). |
| `pedido_items` | `cantidad > 0` | No hay líneas vacías. |
| `notificaciones` | `producto_id` o `pedido_id` obligatorio | Toda notificación apunta a algo. |
| `configuracion` | `id` fijo y `horas_expiracion > 0` | Solo existe una fila de configuración. |
| `historial_tasas` | `tasa > 0` | Tasas válidas. |
| `categorias`, `zonas` | `nombre` único | Sin duplicados. |

### Índices para consultas frecuentes
- `pedidos (estado, creado_en)` y `pedidos (estado, expira_en)`: bandeja de pendientes, job de expiración y KPIs.
- `pedidos (zona_id)` y `pedido_items (producto_id)`: ventas por zona y por producto.
- `productos (activo, stock_disponible)`: catálogo público.
- `movimientos_inventario (producto_id, creado_en)`: historial de movimientos de un producto.
- `notificaciones (leida, creado_en)`: notificaciones sin leer.
- `auditoria (creado_en)` y `auditoria (entidad, entidad_id)`: consultas de auditoría.

---

## 4. Enumeraciones

| Enum | Valores |
| :--- | :--- |
| `rol_usuario` | `cliente`, `ventas`, `repartidor`, `superadmin` |
| `estado_pedido` | `pendiente`, `aprobado`, `rechazado`, `expirado`, `asignado`, `en_camino`, `entregado` |
| `metodo_pago` | `transferencia`, `pago_movil`, `binance` |
| `moneda_pago` | `VES`, `USDT` |
| `tipo_movimiento_inventario` | `reserva`, `venta`, `liberacion`, `reposicion`, `ajuste` |
| `accion_auditoria` | `crear`, `editar`, `borrar`, `descargar_reporte` |
| `tipo_notificacion` | `stock_agotado`, `pedido_nuevo`, `pedido_por_expirar` |
| `estado_mensaje_whatsapp` | `enviado`, `error`, `bloqueado_lista_blanca` |

---

## 5. Datos Semilla

Incluidos en la migración inicial (`Infrastructure/Persistencia/Semillas/DatosSemilla.cs`):

| Categoría | Productos (SKU) |
| :--- | :--- |
| Víveres | VIV-0001 a VIV-0004 (harina, arroz, aceite…) |
| Lácteos y huevos | LAC-0001 a LAC-0003 (leche, queso, huevos) |
| Bebidas | BEB-0001, BEB-0002 (café, refresco) |
| Limpieza del hogar | LIM-0001, LIM-0002 (detergente, cloro) |

**Zonas de entrega:** Centro, Barrio Obrero, Pueblo Nuevo, La Concordia, Santa Teresa.

Al arrancar la API también se crean la fila de `configuracion` (con 5 horas de expiración) y el usuario superadmin inicial.
