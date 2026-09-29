CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    migration_id character varying(150) NOT NULL,
    product_version character varying(32) NOT NULL,
    CONSTRAINT pk___ef_migrations_history PRIMARY KEY (migration_id)
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TYPE accion_auditoria AS ENUM ('borrar', 'crear', 'descargar_reporte', 'editar');
    CREATE TYPE estado_mensaje_whatsapp AS ENUM ('bloqueado_lista_blanca', 'enviado', 'error');
    CREATE TYPE estado_pedido AS ENUM ('aprobado', 'asignado', 'en_camino', 'entregado', 'expirado', 'pendiente', 'rechazado');
    CREATE TYPE metodo_pago AS ENUM ('binance', 'pago_movil', 'transferencia');
    CREATE TYPE moneda_pago AS ENUM ('USDT', 'VES');
    CREATE TYPE rol_usuario AS ENUM ('cliente', 'repartidor', 'superadmin', 'ventas');
    CREATE TYPE tipo_movimiento_inventario AS ENUM ('ajuste', 'liberacion', 'reposicion', 'reserva', 'venta');
    CREATE TYPE tipo_notificacion AS ENUM ('pedido_nuevo', 'pedido_por_expirar', 'stock_agotado');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TABLE categorias (
        id uuid NOT NULL,
        nombre character varying(100) NOT NULL,
        CONSTRAINT pk_categorias PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TABLE configuracion (
        id uuid NOT NULL,
        tasa_bs_usd numeric(18,4),
        numero_soporte character varying(20),
        horas_expiracion integer NOT NULL DEFAULT 5,
        datos_transferencia character varying(1000),
        datos_pago_movil character varying(1000),
        wallet_binance character varying(200),
        numeros_prueba text[] NOT NULL DEFAULT ('{}'),
        CONSTRAINT pk_configuracion PRIMARY KEY (id),
        CONSTRAINT ck_configuracion_horas_expiracion CHECK (horas_expiracion > 0),
        CONSTRAINT ck_configuracion_una_fila CHECK (id = '00000000-0000-0000-0000-000000000001')
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TABLE usuarios (
        id uuid NOT NULL,
        nombre character varying(150) NOT NULL,
        email character varying(254) NOT NULL,
        telefono character varying(20),
        rol rol_usuario NOT NULL,
        google_id character varying(255),
        password_hash character varying(100),
        activo boolean NOT NULL,
        creado_en timestamp with time zone NOT NULL DEFAULT (now()),
        CONSTRAINT pk_usuarios PRIMARY KEY (id),
        CONSTRAINT ck_usuarios_credenciales CHECK ((rol = 'cliente' AND google_id IS NOT NULL) OR (rol <> 'cliente' AND password_hash IS NOT NULL))
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TABLE zonas (
        id uuid NOT NULL,
        nombre character varying(100) NOT NULL,
        activa boolean NOT NULL,
        CONSTRAINT pk_zonas PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TABLE auditoria (
        id uuid NOT NULL,
        usuario_id uuid NOT NULL,
        entidad character varying(50) NOT NULL,
        entidad_id uuid,
        accion accion_auditoria NOT NULL,
        datos_antes jsonb,
        datos_despues jsonb,
        creado_en timestamp with time zone NOT NULL DEFAULT (now()),
        CONSTRAINT pk_auditoria PRIMARY KEY (id),
        CONSTRAINT fk_auditoria_usuarios_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TABLE historial_tasas (
        id uuid NOT NULL,
        tasa numeric(18,4) NOT NULL,
        usuario_id uuid NOT NULL,
        creado_en timestamp with time zone NOT NULL DEFAULT (now()),
        CONSTRAINT pk_historial_tasas PRIMARY KEY (id),
        CONSTRAINT ck_historial_tasas_tasa CHECK (tasa > 0),
        CONSTRAINT fk_historial_tasas_usuarios_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TABLE productos (
        id uuid NOT NULL,
        codigo_sku character varying(30) NOT NULL,
        nombre character varying(200) NOT NULL,
        descripcion character varying(1000),
        precio_usd numeric(18,2) NOT NULL,
        costo_usd numeric(18,2) NOT NULL,
        imagen_url character varying(500),
        categoria_id uuid NOT NULL,
        stock_disponible integer NOT NULL,
        stock_reservado integer NOT NULL,
        activo boolean NOT NULL,
        creado_por uuid,
        creado_en timestamp with time zone NOT NULL DEFAULT (now()),
        actualizado_en timestamp with time zone,
        CONSTRAINT pk_productos PRIMARY KEY (id),
        CONSTRAINT ck_productos_costo_usd CHECK (costo_usd >= 0),
        CONSTRAINT ck_productos_precio_usd CHECK (precio_usd >= 0),
        CONSTRAINT ck_productos_stock_disponible CHECK (stock_disponible >= 0),
        CONSTRAINT ck_productos_stock_reservado CHECK (stock_reservado >= 0),
        CONSTRAINT fk_productos_categorias_categoria_id FOREIGN KEY (categoria_id) REFERENCES categorias (id) ON DELETE RESTRICT,
        CONSTRAINT fk_productos_usuarios_creado_por_id FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TABLE pedidos (
        id uuid NOT NULL,
        numero integer GENERATED ALWAYS AS IDENTITY,
        cliente_id uuid NOT NULL,
        estado estado_pedido NOT NULL,
        metodo_pago metodo_pago NOT NULL,
        moneda_pago moneda_pago NOT NULL,
        tasa_cambio numeric(18,4) NOT NULL,
        total_usd numeric(18,2) NOT NULL,
        total_bs numeric(18,2) NOT NULL,
        referencia_pago character varying(100),
        captura_url character varying(500),
        zona_id uuid NOT NULL,
        direccion_texto character varying(500) NOT NULL,
        latitud double precision,
        longitud double precision,
        telefono_contacto character varying(20) NOT NULL,
        revisado_por uuid,
        revisado_en timestamp with time zone,
        motivo_rechazo character varying(300),
        repartidor_id uuid,
        asignado_en timestamp with time zone,
        en_camino_en timestamp with time zone,
        entregado_en timestamp with time zone,
        expira_en timestamp with time zone NOT NULL,
        creado_en timestamp with time zone NOT NULL DEFAULT (now()),
        CONSTRAINT pk_pedidos PRIMARY KEY (id),
        CONSTRAINT ck_pedidos_totales CHECK (total_usd >= 0 AND total_bs >= 0 AND tasa_cambio > 0),
        CONSTRAINT fk_pedidos_usuarios_cliente_id FOREIGN KEY (cliente_id) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT fk_pedidos_usuarios_repartidor_id FOREIGN KEY (repartidor_id) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT fk_pedidos_usuarios_revisado_por_id FOREIGN KEY (revisado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT fk_pedidos_zonas_zona_id FOREIGN KEY (zona_id) REFERENCES zonas (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TABLE historial_estados_pedido (
        id uuid NOT NULL,
        pedido_id uuid NOT NULL,
        estado_anterior estado_pedido,
        estado_nuevo estado_pedido NOT NULL,
        usuario_id uuid,
        creado_en timestamp with time zone NOT NULL DEFAULT (now()),
        CONSTRAINT pk_historial_estados_pedido PRIMARY KEY (id),
        CONSTRAINT fk_historial_estados_pedido_pedidos_pedido_id FOREIGN KEY (pedido_id) REFERENCES pedidos (id) ON DELETE RESTRICT,
        CONSTRAINT fk_historial_estados_pedido_usuarios_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TABLE mensajes_whatsapp (
        id uuid NOT NULL,
        pedido_id uuid NOT NULL,
        telefono character varying(20) NOT NULL,
        plantilla character varying(50) NOT NULL,
        texto character varying(1000) NOT NULL,
        estado estado_mensaje_whatsapp NOT NULL,
        error character varying(2000),
        creado_en timestamp with time zone NOT NULL DEFAULT (now()),
        CONSTRAINT pk_mensajes_whatsapp PRIMARY KEY (id),
        CONSTRAINT fk_mensajes_whatsapp_pedidos_pedido_id FOREIGN KEY (pedido_id) REFERENCES pedidos (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TABLE movimientos_inventario (
        id uuid NOT NULL,
        producto_id uuid NOT NULL,
        pedido_id uuid,
        usuario_id uuid,
        tipo tipo_movimiento_inventario NOT NULL,
        cantidad integer NOT NULL,
        disponible_antes integer NOT NULL,
        disponible_despues integer NOT NULL,
        creado_en timestamp with time zone NOT NULL DEFAULT (now()),
        CONSTRAINT pk_movimientos_inventario PRIMARY KEY (id),
        CONSTRAINT fk_movimientos_inventario_pedidos_pedido_id FOREIGN KEY (pedido_id) REFERENCES pedidos (id) ON DELETE RESTRICT,
        CONSTRAINT fk_movimientos_inventario_productos_producto_id FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE RESTRICT,
        CONSTRAINT fk_movimientos_inventario_usuarios_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TABLE notificaciones (
        id uuid NOT NULL,
        tipo tipo_notificacion NOT NULL,
        producto_id uuid,
        pedido_id uuid,
        leida boolean NOT NULL,
        creado_en timestamp with time zone NOT NULL DEFAULT (now()),
        CONSTRAINT pk_notificaciones PRIMARY KEY (id),
        CONSTRAINT ck_notificaciones_referencia CHECK (producto_id IS NOT NULL OR pedido_id IS NOT NULL),
        CONSTRAINT fk_notificaciones_pedidos_pedido_id FOREIGN KEY (pedido_id) REFERENCES pedidos (id) ON DELETE RESTRICT,
        CONSTRAINT fk_notificaciones_productos_producto_id FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE TABLE pedido_items (
        id uuid NOT NULL,
        pedido_id uuid NOT NULL,
        producto_id uuid NOT NULL,
        categoria_id uuid NOT NULL,
        cantidad integer NOT NULL,
        precio_usd numeric(18,2) NOT NULL,
        precio_bs numeric(18,2) NOT NULL,
        CONSTRAINT pk_pedido_items PRIMARY KEY (id),
        CONSTRAINT ck_pedido_items_cantidad CHECK (cantidad > 0),
        CONSTRAINT fk_pedido_items_categorias_categoria_id FOREIGN KEY (categoria_id) REFERENCES categorias (id) ON DELETE RESTRICT,
        CONSTRAINT fk_pedido_items_pedidos_pedido_id FOREIGN KEY (pedido_id) REFERENCES pedidos (id) ON DELETE RESTRICT,
        CONSTRAINT fk_pedido_items_productos_producto_id FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    INSERT INTO categorias (id, nombre)
    VALUES ('c1000000-0000-4000-8000-000000000001', 'Víveres');
    INSERT INTO categorias (id, nombre)
    VALUES ('c1000000-0000-4000-8000-000000000002', 'Lácteos y huevos');
    INSERT INTO categorias (id, nombre)
    VALUES ('c1000000-0000-4000-8000-000000000003', 'Bebidas');
    INSERT INTO categorias (id, nombre)
    VALUES ('c1000000-0000-4000-8000-000000000004', 'Limpieza del hogar');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    INSERT INTO zonas (id, activa, nombre)
    VALUES ('e1000000-0000-4000-8000-000000000001', TRUE, 'Centro');
    INSERT INTO zonas (id, activa, nombre)
    VALUES ('e1000000-0000-4000-8000-000000000002', TRUE, 'Barrio Obrero');
    INSERT INTO zonas (id, activa, nombre)
    VALUES ('e1000000-0000-4000-8000-000000000003', TRUE, 'Pueblo Nuevo');
    INSERT INTO zonas (id, activa, nombre)
    VALUES ('e1000000-0000-4000-8000-000000000004', TRUE, 'La Concordia');
    INSERT INTO zonas (id, activa, nombre)
    VALUES ('e1000000-0000-4000-8000-000000000005', TRUE, 'Santa Teresa');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    INSERT INTO productos (id, activo, actualizado_en, categoria_id, codigo_sku, costo_usd, creado_en, creado_por, descripcion, imagen_url, nombre, precio_usd, stock_disponible, stock_reservado)
    VALUES ('a1000000-0000-4000-8000-000000000001', TRUE, NULL, 'c1000000-0000-4000-8000-000000000001', 'VIV-0001', 1.05, TIMESTAMPTZ '2026-09-23T00:00:00Z', NULL, 'Harina blanca para arepas.', NULL, 'Harina de maíz precocida 1 kg', 1.35, 120, 0);
    INSERT INTO productos (id, activo, actualizado_en, categoria_id, codigo_sku, costo_usd, creado_en, creado_por, descripcion, imagen_url, nombre, precio_usd, stock_disponible, stock_reservado)
    VALUES ('a1000000-0000-4000-8000-000000000002', TRUE, NULL, 'c1000000-0000-4000-8000-000000000001', 'VIV-0002', 0.92, TIMESTAMPTZ '2026-09-23T00:00:00Z', NULL, 'Arroz de grano largo.', NULL, 'Arroz blanco tipo I 1 kg', 1.2, 150, 0);
    INSERT INTO productos (id, activo, actualizado_en, categoria_id, codigo_sku, costo_usd, creado_en, creado_por, descripcion, imagen_url, nombre, precio_usd, stock_disponible, stock_reservado)
    VALUES ('a1000000-0000-4000-8000-000000000003', TRUE, NULL, 'c1000000-0000-4000-8000-000000000001', 'VIV-0003', 1.18, TIMESTAMPTZ '2026-09-23T00:00:00Z', NULL, 'Espagueti de sémola de trigo.', NULL, 'Pasta larga 1 kg', 1.6, 90, 0);
    INSERT INTO productos (id, activo, actualizado_en, categoria_id, codigo_sku, costo_usd, creado_en, creado_por, descripcion, imagen_url, nombre, precio_usd, stock_disponible, stock_reservado)
    VALUES ('a1000000-0000-4000-8000-000000000004', TRUE, NULL, 'c1000000-0000-4000-8000-000000000001', 'VIV-0004', 2.55, TIMESTAMPTZ '2026-09-23T00:00:00Z', NULL, 'Aceite de soya.', NULL, 'Aceite vegetal 1 L', 3.2, 60, 0);
    INSERT INTO productos (id, activo, actualizado_en, categoria_id, codigo_sku, costo_usd, creado_en, creado_por, descripcion, imagen_url, nombre, precio_usd, stock_disponible, stock_reservado)
    VALUES ('a1000000-0000-4000-8000-000000000005', TRUE, NULL, 'c1000000-0000-4000-8000-000000000002', 'LAC-0001', 1.4, TIMESTAMPTZ '2026-09-23T00:00:00Z', NULL, 'Leche de larga duración.', NULL, 'Leche completa UHT 1 L', 1.85, 80, 0);
    INSERT INTO productos (id, activo, actualizado_en, categoria_id, codigo_sku, costo_usd, creado_en, creado_por, descripcion, imagen_url, nombre, precio_usd, stock_disponible, stock_reservado)
    VALUES ('a1000000-0000-4000-8000-000000000006', TRUE, NULL, 'c1000000-0000-4000-8000-000000000002', 'LAC-0002', 5.1, TIMESTAMPTZ '2026-09-23T00:00:00Z', NULL, 'Queso llanero.', NULL, 'Queso blanco duro 1 kg', 6.5, 25, 0);
    INSERT INTO productos (id, activo, actualizado_en, categoria_id, codigo_sku, costo_usd, creado_en, creado_por, descripcion, imagen_url, nombre, precio_usd, stock_disponible, stock_reservado)
    VALUES ('a1000000-0000-4000-8000-000000000007', TRUE, NULL, 'c1000000-0000-4000-8000-000000000002', 'LAC-0003', 4.7, TIMESTAMPTZ '2026-09-23T00:00:00Z', NULL, 'Huevos blancos tamaño AA.', NULL, 'Huevos cartón 30 unidades', 5.9, 40, 0);
    INSERT INTO productos (id, activo, actualizado_en, categoria_id, codigo_sku, costo_usd, creado_en, creado_por, descripcion, imagen_url, nombre, precio_usd, stock_disponible, stock_reservado)
    VALUES ('a1000000-0000-4000-8000-000000000008', TRUE, NULL, 'c1000000-0000-4000-8000-000000000003', 'BEB-0001', 3.75, TIMESTAMPTZ '2026-09-23T00:00:00Z', NULL, 'Tueste medio.', NULL, 'Café molido 500 g', 4.8, 50, 0);
    INSERT INTO productos (id, activo, actualizado_en, categoria_id, codigo_sku, costo_usd, creado_en, creado_por, descripcion, imagen_url, nombre, precio_usd, stock_disponible, stock_reservado)
    VALUES ('a1000000-0000-4000-8000-000000000009', TRUE, NULL, 'c1000000-0000-4000-8000-000000000003', 'BEB-0002', 1.55, TIMESTAMPTZ '2026-09-23T00:00:00Z', NULL, 'Bebida gaseosa.', NULL, 'Refresco de cola 2 L', 2.1, 70, 0);
    INSERT INTO productos (id, activo, actualizado_en, categoria_id, codigo_sku, costo_usd, creado_en, creado_por, descripcion, imagen_url, nombre, precio_usd, stock_disponible, stock_reservado)
    VALUES ('a1000000-0000-4000-8000-000000000010', TRUE, NULL, 'c1000000-0000-4000-8000-000000000004', 'LIM-0001', 2.6, TIMESTAMPTZ '2026-09-23T00:00:00Z', NULL, 'Para ropa blanca y de color.', NULL, 'Detergente en polvo 1 kg', 3.4, 45, 0);
    INSERT INTO productos (id, activo, actualizado_en, categoria_id, codigo_sku, costo_usd, creado_en, creado_por, descripcion, imagen_url, nombre, precio_usd, stock_disponible, stock_reservado)
    VALUES ('a1000000-0000-4000-8000-000000000011', TRUE, NULL, 'c1000000-0000-4000-8000-000000000004', 'LIM-0002', 0.9, TIMESTAMPTZ '2026-09-23T00:00:00Z', NULL, 'Blanqueador y desinfectante.', NULL, 'Cloro 1 L', 1.25, 65, 0);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_auditoria_creado_en ON auditoria (creado_en);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_auditoria_entidad_entidad_id ON auditoria (entidad, entidad_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_auditoria_usuario_id ON auditoria (usuario_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_categorias_nombre ON categorias (nombre);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_historial_estados_pedido_pedido_id ON historial_estados_pedido (pedido_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_historial_estados_pedido_usuario_id ON historial_estados_pedido (usuario_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_historial_tasas_usuario_id ON historial_tasas (usuario_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_mensajes_whatsapp_pedido_id ON mensajes_whatsapp (pedido_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_movimientos_inventario_pedido_id ON movimientos_inventario (pedido_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_movimientos_inventario_producto_id_creado_en ON movimientos_inventario (producto_id, creado_en);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_movimientos_inventario_usuario_id ON movimientos_inventario (usuario_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_notificaciones_leida_creado_en ON notificaciones (leida, creado_en);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_notificaciones_pedido_id ON notificaciones (pedido_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_notificaciones_producto_id ON notificaciones (producto_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_pedido_items_categoria_id ON pedido_items (categoria_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_pedido_items_pedido_id ON pedido_items (pedido_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_pedido_items_producto_id ON pedido_items (producto_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_pedidos_cliente_id ON pedidos (cliente_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_pedidos_estado_creado_en ON pedidos (estado, creado_en);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_pedidos_estado_expira_en ON pedidos (estado, expira_en);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_pedidos_numero ON pedidos (numero);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_pedidos_repartidor_id ON pedidos (repartidor_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_pedidos_revisado_por_id ON pedidos (revisado_por);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_pedidos_zona_id ON pedidos (zona_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_productos_activo_stock_disponible ON productos (activo, stock_disponible);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_productos_categoria_id ON productos (categoria_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_productos_codigo_sku ON productos (codigo_sku);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE INDEX ix_productos_creado_por_id ON productos (creado_por);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_usuarios_email ON usuarios (email);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_usuarios_google_id ON usuarios (google_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_zonas_nombre ON zonas (nombre);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260923183522_InitialCreate') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260923183522_InitialCreate', '10.0.12');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    ALTER TABLE zonas ADD creado_en timestamp with time zone NOT NULL DEFAULT (now());
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    ALTER TABLE pedido_items ADD creado_en timestamp with time zone NOT NULL DEFAULT (now());
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    ALTER TABLE configuracion ADD creado_en timestamp with time zone NOT NULL DEFAULT (now());
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    ALTER TABLE categorias ADD creado_en timestamp with time zone NOT NULL DEFAULT (now());
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    UPDATE categorias SET creado_en = TIMESTAMPTZ '2026-09-23T00:00:00Z'
    WHERE id = 'c1000000-0000-4000-8000-000000000001';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    UPDATE categorias SET creado_en = TIMESTAMPTZ '2026-09-23T00:00:00Z'
    WHERE id = 'c1000000-0000-4000-8000-000000000002';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    UPDATE categorias SET creado_en = TIMESTAMPTZ '2026-09-23T00:00:00Z'
    WHERE id = 'c1000000-0000-4000-8000-000000000003';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    UPDATE categorias SET creado_en = TIMESTAMPTZ '2026-09-23T00:00:00Z'
    WHERE id = 'c1000000-0000-4000-8000-000000000004';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    UPDATE zonas SET creado_en = TIMESTAMPTZ '2026-09-23T00:00:00Z'
    WHERE id = 'e1000000-0000-4000-8000-000000000001';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    UPDATE zonas SET creado_en = TIMESTAMPTZ '2026-09-23T00:00:00Z'
    WHERE id = 'e1000000-0000-4000-8000-000000000002';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    UPDATE zonas SET creado_en = TIMESTAMPTZ '2026-09-23T00:00:00Z'
    WHERE id = 'e1000000-0000-4000-8000-000000000003';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    UPDATE zonas SET creado_en = TIMESTAMPTZ '2026-09-23T00:00:00Z'
    WHERE id = 'e1000000-0000-4000-8000-000000000004';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    UPDATE zonas SET creado_en = TIMESTAMPTZ '2026-09-23T00:00:00Z'
    WHERE id = 'e1000000-0000-4000-8000-000000000005';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260925005101_BaseEntityCreatedAt') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260925005101_BaseEntityCreatedAt', '10.0.12');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    ALTER TABLE productos ADD stock_maximo integer NOT NULL DEFAULT 100;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    ALTER TABLE productos ADD stock_minimo integer NOT NULL DEFAULT 5;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    ALTER TABLE productos ADD ubicacion character varying(50);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    ALTER TABLE productos ADD unidad_medida character varying(20) NOT NULL DEFAULT 'unidad';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    UPDATE productos SET stock_maximo = 200, stock_minimo = 20, ubicacion = 'P1-E1', unidad_medida = 'paquete'
    WHERE id = 'a1000000-0000-4000-8000-000000000001';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    UPDATE productos SET stock_maximo = 200, stock_minimo = 20, ubicacion = 'P1-E2', unidad_medida = 'paquete'
    WHERE id = 'a1000000-0000-4000-8000-000000000002';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    UPDATE productos SET stock_maximo = 150, stock_minimo = 10, ubicacion = 'P1-E3', unidad_medida = 'paquete'
    WHERE id = 'a1000000-0000-4000-8000-000000000003';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    UPDATE productos SET stock_maximo = 100, stock_minimo = 10, ubicacion = 'P1-E4', unidad_medida = 'botella'
    WHERE id = 'a1000000-0000-4000-8000-000000000004';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    UPDATE productos SET stock_maximo = 120, stock_minimo = 10, ubicacion = 'R1-N1', unidad_medida = 'caja'
    WHERE id = 'a1000000-0000-4000-8000-000000000005';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    UPDATE productos SET stock_maximo = 40, stock_minimo = 5, ubicacion = 'R1-N2', unidad_medida = 'kg'
    WHERE id = 'a1000000-0000-4000-8000-000000000006';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    UPDATE productos SET stock_maximo = 60, stock_minimo = 5, ubicacion = 'R1-N3', unidad_medida = 'cartón'
    WHERE id = 'a1000000-0000-4000-8000-000000000007';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    UPDATE productos SET stock_maximo = 80, stock_minimo = 5, ubicacion = 'P2-E1', unidad_medida = 'paquete'
    WHERE id = 'a1000000-0000-4000-8000-000000000008';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    UPDATE productos SET stock_maximo = 100, stock_minimo = 10, ubicacion = 'P2-E2', unidad_medida = 'botella'
    WHERE id = 'a1000000-0000-4000-8000-000000000009';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    UPDATE productos SET stock_maximo = 80, stock_minimo = 5, ubicacion = 'P3-E1', unidad_medida = 'bolsa'
    WHERE id = 'a1000000-0000-4000-8000-000000000010';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    UPDATE productos SET stock_maximo = 100, stock_minimo = 10, ubicacion = 'P3-E2', unidad_medida = 'botella'
    WHERE id = 'a1000000-0000-4000-8000-000000000011';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    ALTER TABLE productos ADD CONSTRAINT ck_productos_stock_maximo CHECK (stock_maximo > stock_minimo);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    ALTER TABLE productos ADD CONSTRAINT ck_productos_stock_minimo CHECK (stock_minimo >= 0);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260929014037_ProductoLimitesStockUbicacion') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260929014037_ProductoLimitesStockUbicacion', '10.0.12');
    END IF;
END $EF$;
COMMIT;

