# Evidencias — Base de datos PostgreSQL

[← Volver a MODELO_DATOS.md](../MODELO_DATOS.md)

Estado real de la base `midatabase` en PostgreSQL 16.15 tras aplicar las cuatro migraciones (`dotnet ef database update`) y arrancar la API una vez con la **siembra de demostración** activada. Ese arranque crea la fila de configuración y el superadmin inicial, y simula 90 días de operación: personal, clientes, catálogo ampliado, historial de tasas y pedidos con su inventario, historial de estados, notificaciones y auditoría. Se acompaña de dos scripts en [`database/`](../../database):

| Archivo | Contenido |
| :--- | :--- |
| [`midatabase_dump.sql`](../../database/midatabase_dump.sql) | Volcado completo exportado con `pg_dump`: tipos enumerados, tablas, claves primarias y foráneas, restricciones `CHECK`, índices y datos sembrados (9.809 `INSERT`, 3,5 MB). |
| [`consultas_verificacion.sql`](../../database/consultas_verificacion.sql) | Consultas al catálogo de PostgreSQL que listan tablas, restricciones y datos sembrados. Sus resultados se muestran abajo. |
| [`InitialCreate.sql`](../../database/InitialCreate.sql) | Script idempotente generado desde las migraciones de EF Core (`dotnet ef migrations script`). |

## Cómo reproducirlo

**Restaurar el volcado.** Sobre una base vacía, desde pgAdmin (*Query Tool* → abrir el archivo → ejecutar), DBeaver (*Execute SQL Script*) o la terminal:

```bash
psql -U miusuario -d midatabase -v ON_ERROR_STOP=1 -f database/midatabase_dump.sql
```

El volcado usa `INSERT` en lugar de `COPY ... FROM stdin`, por lo que también se ejecuta desde las herramientas gráficas. Se probó restaurándolo en una base limpia sin errores.

**Regenerar el volcado.** Sobre una base vacía (por ejemplo, la de `docker compose up -d db`), aplicar las migraciones, arrancar la API una vez con la siembra de demostración y exportar:

```bash
dotnet ef database update --project src/backend/Infrastructure --startup-project src/backend/Presentation.API
dotnet run --project src/backend/Presentation.API -- --SiembraDemo:Habilitada=true   # Ctrl+C al terminar la siembra
docker exec postgres_db pg_dump -U miusuario -d midatabase --no-owner --no-privileges --column-inserts \
  | sed '/^[\]restrict /d;/^[\]unrestrict /d' > database/midatabase_dump.sql
```

> La siembra de demostración usa una semilla fija (`SiembraDemo:Semilla = 2026`), pero las fechas se calculan hacia atrás desde el día de ejecución, así que un volcado nuevo tendrá otras fechas e identificadores.
>
> Las líneas `\restrict` / `\unrestrict` que añade `pg_dump` 16.10+ son metacomandos de `psql`; se eliminan para que el script funcione en pgAdmin y DBeaver.

---

## 1. Tablas

14 tablas del dominio más el historial de migraciones de EF Core.

```
          tabla           | columnas
--------------------------+----------
 __EFMigrationsHistory    |        2
 auditoria                |        8
 categorias               |        3
 configuracion            |        9
 historial_estados_pedido |        6
 historial_tasas          |        4
 mensajes_whatsapp        |        8
 movimientos_inventario   |        9
 notificaciones           |        6
 pedido_items             |        8
 pedidos                  |       25
 productos                |       18
 refresh_tokens           |        7
 usuarios                 |        9
 zonas                    |        4
(15 rows)
```

## 2. Tipos enumerados nativos

```
            enum            |                                 valores
----------------------------+--------------------------------------------------------------------------
 accion_auditoria           | borrar, crear, descargar_reporte, editar
 estado_mensaje_whatsapp    | bloqueado_lista_blanca, enviado, error
 estado_pedido              | aprobado, asignado, en_camino, entregado, expirado, pendiente, rechazado
 metodo_pago                | binance, pago_movil, transferencia
 moneda_pago                | USDT, VES
 rol_usuario                | cliente, repartidor, superadmin, ventas
 tipo_movimiento_inventario | ajuste, liberacion, reposicion, reserva, venta
 tipo_notificacion          | pedido_nuevo, pedido_por_expirar, stock_agotado
(8 rows)
```

## 3. Restricciones

### 3.1 Resumen

```
    tipo     | total
-------------+-------
 FOREIGN KEY |    20
 PRIMARY KEY |    15
 CHECK       |    13
(3 rows)
```

La unicidad se implementa con índices únicos (sección 3.4), por eso no aparecen restricciones `UNIQUE`.

### 3.2 Restricciones `CHECK`

```
      tabla      |            restriccion            |                         definicion
-----------------+-----------------------------------+--------------------------------------------------------------------------------------------
 configuracion   | ck_configuracion_horas_expiracion | CHECK ((horas_expiracion > 0))
 configuracion   | ck_configuracion_una_fila         | CHECK ((id = '00000000-0000-0000-0000-000000000001'::uuid))
 usuarios        | ck_usuarios_credenciales          | CHECK ((((rol = 'cliente'::rol_usuario) AND (google_id IS NOT NULL))
                 |                                   |    OR ((rol <> 'cliente'::rol_usuario) AND (password_hash IS NOT NULL))))
 historial_tasas | ck_historial_tasas_tasa           | CHECK ((tasa > (0)::numeric))
 productos       | ck_productos_costo_usd            | CHECK ((costo_usd >= (0)::numeric))
 productos       | ck_productos_precio_usd           | CHECK ((precio_usd >= (0)::numeric))
 productos       | ck_productos_stock_disponible     | CHECK ((stock_disponible >= 0))
 productos       | ck_productos_stock_maximo         | CHECK ((stock_maximo > stock_minimo))
 productos       | ck_productos_stock_minimo         | CHECK ((stock_minimo >= 0))
 productos       | ck_productos_stock_reservado      | CHECK ((stock_reservado >= 0))
 pedidos         | ck_pedidos_totales                | CHECK (((total_usd >= (0)::numeric) AND (total_bs >= (0)::numeric)
                 |                                   |    AND (tasa_cambio > (0)::numeric)))
 notificaciones  | ck_notificaciones_referencia      | CHECK (((producto_id IS NOT NULL) OR (pedido_id IS NOT NULL)))
 pedido_items    | ck_pedido_items_cantidad          | CHECK ((cantidad > 0))
(13 rows)
```

### 3.3 Claves foráneas

Todas usan `ON DELETE RESTRICT` (los productos se desactivan con borrado lógico y los pedidos nunca se borran), salvo los refresh tokens, que se eliminan en cascada con su usuario.

```
          tabla           |                   restriccion                   |                               definicion
--------------------------+-------------------------------------------------+-------------------------------------------------------------------------
 auditoria                | fk_auditoria_usuarios_usuario_id                | FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
 historial_tasas          | fk_historial_tasas_usuarios_usuario_id          | FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
 productos                | fk_productos_categorias_categoria_id            | FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
 productos                | fk_productos_usuarios_creado_por_id             | FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE RESTRICT
 pedidos                  | fk_pedidos_usuarios_cliente_id                  | FOREIGN KEY (cliente_id) REFERENCES usuarios(id) ON DELETE RESTRICT
 pedidos                  | fk_pedidos_usuarios_repartidor_id               | FOREIGN KEY (repartidor_id) REFERENCES usuarios(id) ON DELETE RESTRICT
 pedidos                  | fk_pedidos_usuarios_revisado_por_id             | FOREIGN KEY (revisado_por) REFERENCES usuarios(id) ON DELETE RESTRICT
 pedidos                  | fk_pedidos_zonas_zona_id                        | FOREIGN KEY (zona_id) REFERENCES zonas(id) ON DELETE RESTRICT
 historial_estados_pedido | fk_historial_estados_pedido_pedidos_pedido_id   | FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT
 historial_estados_pedido | fk_historial_estados_pedido_usuarios_usuario_id | FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
 mensajes_whatsapp        | fk_mensajes_whatsapp_pedidos_pedido_id          | FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT
 movimientos_inventario   | fk_movimientos_inventario_pedidos_pedido_id     | FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT
 movimientos_inventario   | fk_movimientos_inventario_productos_producto_id | FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
 movimientos_inventario   | fk_movimientos_inventario_usuarios_usuario_id   | FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
 notificaciones           | fk_notificaciones_pedidos_pedido_id             | FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT
 notificaciones           | fk_notificaciones_productos_producto_id         | FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
 pedido_items             | fk_pedido_items_categorias_categoria_id         | FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
 pedido_items             | fk_pedido_items_pedidos_pedido_id               | FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT
 pedido_items             | fk_pedido_items_productos_producto_id           | FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
 refresh_tokens           | fk_refresh_tokens_usuarios_usuario_id           | FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
(20 rows)
```

### 3.4 Índices únicos

```
     tabla      |            indice            |                                             definicion
----------------+------------------------------+----------------------------------------------------------------------------------------------------
 categorias     | ix_categorias_nombre         | CREATE UNIQUE INDEX ix_categorias_nombre ON public.categorias USING btree (nombre)
 pedidos        | ix_pedidos_numero            | CREATE UNIQUE INDEX ix_pedidos_numero ON public.pedidos USING btree (numero)
 productos      | ix_productos_codigo_sku      | CREATE UNIQUE INDEX ix_productos_codigo_sku ON public.productos USING btree (codigo_sku)
 refresh_tokens | ix_refresh_tokens_token_hash | CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash)
 usuarios       | ix_usuarios_email            | CREATE UNIQUE INDEX ix_usuarios_email ON public.usuarios USING btree (email)
 usuarios       | ix_usuarios_google_id        | CREATE UNIQUE INDEX ix_usuarios_google_id ON public.usuarios USING btree (google_id)
 zonas          | ix_zonas_nombre              | CREATE UNIQUE INDEX ix_zonas_nombre ON public.zonas USING btree (nombre)
(7 rows)
```

---

## 4. Datos sembrados

| Origen | Datos |
| :--- | :--- |
| Migración (`HasData`) | 4 categorías, 11 productos base y 5 zonas de entrega |
| Arranque de la API ([`InicializadorBaseDatos`](../../src/backend/Infrastructure/Persistencia/Semillas/InicializadorBaseDatos.cs)) | Fila de configuración y superadmin `gerente@almacen.local` |
| Siembra de demostración ([`SembradorDemo`](../../src/backend/Infrastructure/Persistencia/Semillas/SembradorDemo.cs)) | 5 empleados, 60 clientes, 25 productos extra, 91 tasas, 609 pedidos con 1.850 ítems, 3.737 movimientos de inventario, 663 notificaciones y 63 registros de auditoría |

Los nombres, correos y teléfonos de clientes y empleados son ficticios (generados con Bogus).

### 4.1 Filas por tabla

`mensajes_whatsapp` y `refresh_tokens` quedan vacías: se llenan al operar la API (envío de mensajes e inicios de sesión).

```
          tabla           | filas
--------------------------+-------
 auditoria                |    63
 categorias               |     4
 configuracion            |     1
 historial_estados_pedido |  2680
 historial_tasas          |    91
 mensajes_whatsapp        |     0
 movimientos_inventario   |  3737
 notificaciones           |   663
 pedido_items             |  1850
 pedidos                  |   609
 productos                |    36
 refresh_tokens           |     0
 usuarios                 |    66
 zonas                    |     5
(14 rows)
```

### 4.2 Productos por categoría

```
     categoria      | productos | stock_disponible | stock_reservado
--------------------+-----------+------------------+-----------------
 Bebidas            |         7 |              322 |              14
 Lácteos y huevos   |         8 |              237 |               2
 Limpieza del hogar |         7 |              354 |               5
 Víveres            |        14 |              763 |              28
(4 rows)
```

El stock reservado corresponde a los 8 pedidos que siguen pendientes de revisión.

### 4.3 Muestra de productos

```
 codigo_sku |               nombre                |    categoria     | precio_usd | costo_usd | stock_disponible | stock_minimo | stock_maximo
------------+-------------------------------------+------------------+------------+-----------+------------------+--------------+--------------
 BEB-0001   | Café molido 500 g                   | Bebidas          |       4.80 |      3.75 |               76 |            5 |           80
 BEB-0002   | Refresco de cola 2 L                | Bebidas          |       2.10 |      1.55 |               19 |           10 |          100
 BEB-0003   | Agua mineral 1,5 L                  | Bebidas          |       0.90 |      0.55 |               12 |            5 |          100
 BEB-0004   | Jugo de naranja 1 L                 | Bebidas          |       2.30 |      1.70 |                0 |            5 |          100
 BEB-0005   | Malta 355 ml                        | Bebidas          |       0.85 |      0.60 |               83 |            5 |          100
 BEB-0006   | Té frío de limón 1,5 L              | Bebidas          |       1.80 |      1.30 |               48 |            5 |          100
 BEB-0007   | Cerveza en lata 355 ml (6 unidades) | Bebidas          |       6.50 |      5.00 |               84 |            5 |          100
 LAC-0001   | Leche completa UHT 1 L              | Lácteos y huevos |       1.85 |      1.40 |               70 |           10 |          120
 LAC-0002   | Queso blanco duro 1 kg              | Lácteos y huevos |       6.50 |      5.10 |                0 |            5 |           40
 LAC-0003   | Huevos cartón 30 unidades           | Lácteos y huevos |       5.90 |      4.70 |               62 |            5 |           60
 LAC-0004   | Yogurt natural 1 L                  | Lácteos y huevos |       3.20 |      2.40 |               12 |            5 |          100
 LAC-0005   | Queso amarillo rebanado 250 g       | Lácteos y huevos |       3.80 |      2.90 |               16 |            5 |          100
(12 rows)
```

### 4.4 Zonas de entrega

```
    nombre     | activa
---------------+--------
 Barrio Obrero | t
 Centro        | t
 La Concordia  | t
 Pueblo Nuevo  | t
 Santa Teresa  | t
(5 rows)
```

### 4.5 Usuarios y personal

```
    rol     | usuarios
------------+----------
 cliente    |       60
 repartidor |        3
 superadmin |        1
 ventas     |        2
(4 rows)

     nombre     |           email           |    rol     | activo
----------------+---------------------------+------------+--------
 Alberto Tovar  | repartidor1@almacen.local | repartidor | t
 Fernando Banda | repartidor2@almacen.local | repartidor | t
 Marilú Montoya | repartidor3@almacen.local | repartidor | t
 Gerente        | gerente@almacen.local     | superadmin | t
 Germán Cruz    | ventas1@almacen.local     | ventas     | t
 Pilar Cardona  | ventas2@almacen.local     | ventas     | t
(6 rows)
```

El personal de demostración usa la contraseña `Demo1234!` (`SiembraDemo:Password`); el gerente, `Cambiar123!`.

### 4.6 Pedidos

```
  estado   | pedidos | total_usd
-----------+---------+-----------
 entregado |     490 |   9952.00
 rechazado |      59 |   1143.55
 expirado  |      52 |   1079.40
 pendiente |       8 |    143.70
(4 rows)

  metodo_pago  | pedidos
---------------+---------
 pago_movil    |     320
 transferencia |     173
 binance       |     116
(3 rows)
```

### 4.7 Movimientos de inventario

Cada pedido reserva stock al crearse (`reserva`) y, al revisarse, lo vende (`venta`) o lo devuelve (`liberacion`) si se rechaza o expira.

```
    tipo    | movimientos | unidades
------------+-------------+----------
 ajuste     |           2 |      -96
 liberacion |         333 |      863
 reposicion |          55 |     4836
 reserva    |        1850 |    -4722
 venta      |        1497 |    -3810
(5 rows)
```

### 4.8 Tasa de cambio y configuración

Primera y última tasa del historial (90 días) y configuración vigente:

```
  tasa   |       creado_en
---------+------------------------
 36.5400 | 2026-07-03 12:30:00+00
 43.8600 | 2026-10-01 12:30:00+00
(2 rows)

 tasa_bs_usd | horas_expiracion
-------------+------------------
     43.8600 |                5
(1 row)
```

### 4.9 Integridad de los datos

Ningún producto con stock negativo y todos los pedidos tienen ítems e historial de estados:

```
 stock_negativo | pedidos_sin_items | pedidos_sin_historial
----------------+-------------------+-----------------------
              0 |                 0 |                     0
(1 row)
```

## 5. Migraciones aplicadas

```
                 migration_id                 | product_version
----------------------------------------------+-----------------
 20260923183522_InitialCreate                 | 10.0.12
 20260925005101_BaseEntityCreatedAt           | 10.0.12
 20260929014037_ProductoLimitesStockUbicacion | 10.0.12
 20261002001416_RefreshTokens                 | 10.0.12
(4 rows)
```
