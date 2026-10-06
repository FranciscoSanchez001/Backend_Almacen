-- Consultas de verificación de la base de datos `midatabase`.
-- Se pueden ejecutar en pgAdmin (Query Tool), DBeaver o psql sobre una base con las
-- migraciones aplicadas. Evidencian las tablas, las restricciones y los datos sembrados.

-- 1. Tablas del esquema public con su número de columnas.
SELECT t.table_name AS tabla,
       (SELECT count(*) FROM information_schema.columns c
         WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) AS columnas
FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

-- 2. Tipos enumerados nativos de PostgreSQL y sus valores.
SELECT t.typname AS enum,
       string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- 3. Resumen de restricciones por tipo (PK, FK, UNIQUE, CHECK).
SELECT CASE c.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY'
                      WHEN 'u' THEN 'UNIQUE' WHEN 'c' THEN 'CHECK' END AS tipo,
       count(*) AS total
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' AND c.contype IN ('p', 'f', 'u', 'c')
GROUP BY c.contype
ORDER BY total DESC;

-- 4. Restricciones CHECK con su definición.
SELECT c.conrelid::regclass AS tabla, c.conname AS restriccion,
       pg_get_constraintdef(c.oid) AS definicion
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' AND c.contype = 'c'
ORDER BY 1, 2;

-- 5. Claves foráneas con su acción ON DELETE.
SELECT c.conrelid::regclass AS tabla, c.conname AS restriccion,
       pg_get_constraintdef(c.oid) AS definicion
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' AND c.contype = 'f'
ORDER BY 1, 2;

-- 6. Índices únicos (incluye los filtrados).
SELECT tablename AS tabla, indexname AS indice, indexdef AS definicion
FROM pg_indexes
WHERE schemaname = 'public' AND indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexname NOT LIKE 'pk_%'
ORDER BY 1, 2;

-- 7. Filas por tabla tras la siembra.
SELECT 'auditoria' AS tabla, count(*) AS filas FROM auditoria
UNION ALL SELECT 'categorias', count(*) FROM categorias
UNION ALL SELECT 'configuracion', count(*) FROM configuracion
UNION ALL SELECT 'historial_estados_pedido', count(*) FROM historial_estados_pedido
UNION ALL SELECT 'historial_tasas', count(*) FROM historial_tasas
UNION ALL SELECT 'mensajes_whatsapp', count(*) FROM mensajes_whatsapp
UNION ALL SELECT 'movimientos_inventario', count(*) FROM movimientos_inventario
UNION ALL SELECT 'notificaciones', count(*) FROM notificaciones
UNION ALL SELECT 'pedido_items', count(*) FROM pedido_items
UNION ALL SELECT 'pedidos', count(*) FROM pedidos
UNION ALL SELECT 'productos', count(*) FROM productos
UNION ALL SELECT 'refresh_tokens', count(*) FROM refresh_tokens
UNION ALL SELECT 'usuarios', count(*) FROM usuarios
UNION ALL SELECT 'zonas', count(*) FROM zonas
ORDER BY tabla;

-- 8. Datos sembrados: categorías.
SELECT nombre FROM categorias ORDER BY nombre;

-- 9. Datos sembrados: productos por categoría.
SELECT c.nombre AS categoria, count(p.id) AS productos,
       sum(p.stock_disponible) AS stock_disponible, sum(p.stock_reservado) AS stock_reservado
FROM categorias c
LEFT JOIN productos p ON p.categoria_id = c.id
GROUP BY c.nombre
ORDER BY c.nombre;

-- 10. Datos sembrados: muestra de productos.
SELECT p.codigo_sku, p.nombre, c.nombre AS categoria, p.precio_usd, p.costo_usd,
       p.stock_disponible, p.stock_minimo, p.stock_maximo
FROM productos p
JOIN categorias c ON c.id = p.categoria_id
ORDER BY p.codigo_sku
LIMIT 12;

-- 11. Datos sembrados: zonas de entrega.
SELECT nombre, activa FROM zonas ORDER BY nombre;

-- 12. Datos sembrados: usuarios por rol y personal.
SELECT rol, count(*) AS usuarios FROM usuarios GROUP BY rol ORDER BY rol;
SELECT nombre, email, rol, activo FROM usuarios WHERE rol <> 'cliente' ORDER BY rol, email;

-- 13. Datos sembrados: pedidos por estado y método de pago.
SELECT estado, count(*) AS pedidos, sum(total_usd) AS total_usd
FROM pedidos GROUP BY estado ORDER BY pedidos DESC;
SELECT metodo_pago, count(*) AS pedidos FROM pedidos GROUP BY metodo_pago ORDER BY pedidos DESC;

-- 14. Datos sembrados: movimientos de inventario por tipo.
SELECT tipo, count(*) AS movimientos, sum(cantidad) AS unidades
FROM movimientos_inventario GROUP BY tipo ORDER BY tipo;

-- 15. Datos sembrados: tasa de cambio (primera, última) y configuración.
(SELECT tasa, creado_en FROM historial_tasas ORDER BY creado_en LIMIT 1)
UNION ALL
(SELECT tasa, creado_en FROM historial_tasas ORDER BY creado_en DESC LIMIT 1);
SELECT tasa_bs_usd, horas_expiracion FROM configuracion;

-- 16. Integridad: el stock nunca es negativo y cada pedido tiene ítems e historial.
SELECT (SELECT count(*) FROM productos WHERE stock_disponible < 0 OR stock_reservado < 0) AS stock_negativo,
       (SELECT count(*) FROM pedidos p WHERE NOT EXISTS (SELECT 1 FROM pedido_items i WHERE i.pedido_id = p.id)) AS pedidos_sin_items,
       (SELECT count(*) FROM pedidos p WHERE NOT EXISTS (SELECT 1 FROM historial_estados_pedido h WHERE h.pedido_id = p.id)) AS pedidos_sin_historial;

-- 17. Migraciones aplicadas.
SELECT migration_id, product_version FROM "__EFMigrationsHistory" ORDER BY migration_id;
