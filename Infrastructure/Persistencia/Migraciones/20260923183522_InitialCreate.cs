using System;
using System.Collections.Generic;
using Backend_Almacen.Domain.Enums;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Backend_Almacen.Infrastructure.Persistencia.Migraciones
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:accion_auditoria", "borrar,crear,descargar_reporte,editar")
                .Annotation("Npgsql:Enum:estado_mensaje_whatsapp", "bloqueado_lista_blanca,enviado,error")
                .Annotation("Npgsql:Enum:estado_pedido", "aprobado,asignado,en_camino,entregado,expirado,pendiente,rechazado")
                .Annotation("Npgsql:Enum:metodo_pago", "binance,pago_movil,transferencia")
                .Annotation("Npgsql:Enum:moneda_pago", "USDT,VES")
                .Annotation("Npgsql:Enum:rol_usuario", "cliente,repartidor,superadmin,ventas")
                .Annotation("Npgsql:Enum:tipo_movimiento_inventario", "ajuste,liberacion,reposicion,reserva,venta")
                .Annotation("Npgsql:Enum:tipo_notificacion", "pedido_nuevo,pedido_por_expirar,stock_agotado");

            migrationBuilder.CreateTable(
                name: "categorias",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    nombre = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_categorias", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "configuracion",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tasa_bs_usd = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    numero_soporte = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    horas_expiracion = table.Column<int>(type: "integer", nullable: false, defaultValue: 5),
                    datos_transferencia = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    datos_pago_movil = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    wallet_binance = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    numeros_prueba = table.Column<List<string>>(type: "text[]", nullable: false, defaultValueSql: "'{}'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_configuracion", x => x.id);
                    table.CheckConstraint("ck_configuracion_horas_expiracion", "horas_expiracion > 0");
                    table.CheckConstraint("ck_configuracion_una_fila", "id = '00000000-0000-0000-0000-000000000001'");
                });

            migrationBuilder.CreateTable(
                name: "usuarios",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    nombre = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    telefono = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    rol = table.Column<RolUsuario>(type: "rol_usuario", nullable: false),
                    google_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    password_hash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    activo = table.Column<bool>(type: "boolean", nullable: false),
                    creado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_usuarios", x => x.id);
                    table.CheckConstraint("ck_usuarios_credenciales", "(rol = 'cliente' AND google_id IS NOT NULL) OR (rol <> 'cliente' AND password_hash IS NOT NULL)");
                });

            migrationBuilder.CreateTable(
                name: "zonas",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    nombre = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    activa = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_zonas", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "auditoria",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    usuario_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entidad = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    entidad_id = table.Column<Guid>(type: "uuid", nullable: true),
                    accion = table.Column<AccionAuditoria>(type: "accion_auditoria", nullable: false),
                    datos_antes = table.Column<string>(type: "jsonb", nullable: true),
                    datos_despues = table.Column<string>(type: "jsonb", nullable: true),
                    creado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_auditoria", x => x.id);
                    table.ForeignKey(
                        name: "fk_auditoria_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "historial_tasas",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tasa = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    usuario_id = table.Column<Guid>(type: "uuid", nullable: false),
                    creado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_historial_tasas", x => x.id);
                    table.CheckConstraint("ck_historial_tasas_tasa", "tasa > 0");
                    table.ForeignKey(
                        name: "fk_historial_tasas_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "productos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    codigo_sku = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    descripcion = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    precio_usd = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    costo_usd = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    imagen_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    categoria_id = table.Column<Guid>(type: "uuid", nullable: false),
                    stock_disponible = table.Column<int>(type: "integer", nullable: false),
                    stock_reservado = table.Column<int>(type: "integer", nullable: false),
                    activo = table.Column<bool>(type: "boolean", nullable: false),
                    creado_por = table.Column<Guid>(type: "uuid", nullable: true),
                    creado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    actualizado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_productos", x => x.id);
                    table.CheckConstraint("ck_productos_costo_usd", "costo_usd >= 0");
                    table.CheckConstraint("ck_productos_precio_usd", "precio_usd >= 0");
                    table.CheckConstraint("ck_productos_stock_disponible", "stock_disponible >= 0");
                    table.CheckConstraint("ck_productos_stock_reservado", "stock_reservado >= 0");
                    table.ForeignKey(
                        name: "fk_productos_categorias_categoria_id",
                        column: x => x.categoria_id,
                        principalTable: "categorias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_productos_usuarios_creado_por_id",
                        column: x => x.creado_por,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "pedidos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    numero = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    cliente_id = table.Column<Guid>(type: "uuid", nullable: false),
                    estado = table.Column<EstadoPedido>(type: "estado_pedido", nullable: false),
                    metodo_pago = table.Column<MetodoPago>(type: "metodo_pago", nullable: false),
                    moneda_pago = table.Column<MonedaPago>(type: "moneda_pago", nullable: false),
                    tasa_cambio = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    total_usd = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    total_bs = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    referencia_pago = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    captura_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    zona_id = table.Column<Guid>(type: "uuid", nullable: false),
                    direccion_texto = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    latitud = table.Column<double>(type: "double precision", nullable: true),
                    longitud = table.Column<double>(type: "double precision", nullable: true),
                    telefono_contacto = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    revisado_por = table.Column<Guid>(type: "uuid", nullable: true),
                    revisado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    motivo_rechazo = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    repartidor_id = table.Column<Guid>(type: "uuid", nullable: true),
                    asignado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    en_camino_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    entregado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    expira_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    creado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pedidos", x => x.id);
                    table.CheckConstraint("ck_pedidos_totales", "total_usd >= 0 AND total_bs >= 0 AND tasa_cambio > 0");
                    table.ForeignKey(
                        name: "fk_pedidos_usuarios_cliente_id",
                        column: x => x.cliente_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_pedidos_usuarios_repartidor_id",
                        column: x => x.repartidor_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_pedidos_usuarios_revisado_por_id",
                        column: x => x.revisado_por,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_pedidos_zonas_zona_id",
                        column: x => x.zona_id,
                        principalTable: "zonas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "historial_estados_pedido",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    pedido_id = table.Column<Guid>(type: "uuid", nullable: false),
                    estado_anterior = table.Column<EstadoPedido>(type: "estado_pedido", nullable: true),
                    estado_nuevo = table.Column<EstadoPedido>(type: "estado_pedido", nullable: false),
                    usuario_id = table.Column<Guid>(type: "uuid", nullable: true),
                    creado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_historial_estados_pedido", x => x.id);
                    table.ForeignKey(
                        name: "fk_historial_estados_pedido_pedidos_pedido_id",
                        column: x => x.pedido_id,
                        principalTable: "pedidos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_historial_estados_pedido_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "mensajes_whatsapp",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    pedido_id = table.Column<Guid>(type: "uuid", nullable: false),
                    telefono = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    plantilla = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    texto = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    estado = table.Column<EstadoMensajeWhatsapp>(type: "estado_mensaje_whatsapp", nullable: false),
                    error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    creado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_mensajes_whatsapp", x => x.id);
                    table.ForeignKey(
                        name: "fk_mensajes_whatsapp_pedidos_pedido_id",
                        column: x => x.pedido_id,
                        principalTable: "pedidos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "movimientos_inventario",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    producto_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pedido_id = table.Column<Guid>(type: "uuid", nullable: true),
                    usuario_id = table.Column<Guid>(type: "uuid", nullable: true),
                    tipo = table.Column<TipoMovimientoInventario>(type: "tipo_movimiento_inventario", nullable: false),
                    cantidad = table.Column<int>(type: "integer", nullable: false),
                    disponible_antes = table.Column<int>(type: "integer", nullable: false),
                    disponible_despues = table.Column<int>(type: "integer", nullable: false),
                    creado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_movimientos_inventario", x => x.id);
                    table.ForeignKey(
                        name: "fk_movimientos_inventario_pedidos_pedido_id",
                        column: x => x.pedido_id,
                        principalTable: "pedidos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_movimientos_inventario_productos_producto_id",
                        column: x => x.producto_id,
                        principalTable: "productos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_movimientos_inventario_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "notificaciones",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tipo = table.Column<TipoNotificacion>(type: "tipo_notificacion", nullable: false),
                    producto_id = table.Column<Guid>(type: "uuid", nullable: true),
                    pedido_id = table.Column<Guid>(type: "uuid", nullable: true),
                    leida = table.Column<bool>(type: "boolean", nullable: false),
                    creado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notificaciones", x => x.id);
                    table.CheckConstraint("ck_notificaciones_referencia", "producto_id IS NOT NULL OR pedido_id IS NOT NULL");
                    table.ForeignKey(
                        name: "fk_notificaciones_pedidos_pedido_id",
                        column: x => x.pedido_id,
                        principalTable: "pedidos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_notificaciones_productos_producto_id",
                        column: x => x.producto_id,
                        principalTable: "productos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "pedido_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    pedido_id = table.Column<Guid>(type: "uuid", nullable: false),
                    producto_id = table.Column<Guid>(type: "uuid", nullable: false),
                    categoria_id = table.Column<Guid>(type: "uuid", nullable: false),
                    cantidad = table.Column<int>(type: "integer", nullable: false),
                    precio_usd = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    precio_bs = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pedido_items", x => x.id);
                    table.CheckConstraint("ck_pedido_items_cantidad", "cantidad > 0");
                    table.ForeignKey(
                        name: "fk_pedido_items_categorias_categoria_id",
                        column: x => x.categoria_id,
                        principalTable: "categorias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_pedido_items_pedidos_pedido_id",
                        column: x => x.pedido_id,
                        principalTable: "pedidos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_pedido_items_productos_producto_id",
                        column: x => x.producto_id,
                        principalTable: "productos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "categorias",
                columns: new[] { "id", "nombre" },
                values: new object[,]
                {
                    { new Guid("c1000000-0000-4000-8000-000000000001"), "Víveres" },
                    { new Guid("c1000000-0000-4000-8000-000000000002"), "Lácteos y huevos" },
                    { new Guid("c1000000-0000-4000-8000-000000000003"), "Bebidas" },
                    { new Guid("c1000000-0000-4000-8000-000000000004"), "Limpieza del hogar" }
                });

            migrationBuilder.InsertData(
                table: "zonas",
                columns: new[] { "id", "activa", "nombre" },
                values: new object[,]
                {
                    { new Guid("e1000000-0000-4000-8000-000000000001"), true, "Centro" },
                    { new Guid("e1000000-0000-4000-8000-000000000002"), true, "Barrio Obrero" },
                    { new Guid("e1000000-0000-4000-8000-000000000003"), true, "Pueblo Nuevo" },
                    { new Guid("e1000000-0000-4000-8000-000000000004"), true, "La Concordia" },
                    { new Guid("e1000000-0000-4000-8000-000000000005"), true, "Santa Teresa" }
                });

            migrationBuilder.InsertData(
                table: "productos",
                columns: new[] { "id", "activo", "actualizado_en", "categoria_id", "codigo_sku", "costo_usd", "creado_en", "creado_por", "descripcion", "imagen_url", "nombre", "precio_usd", "stock_disponible", "stock_reservado" },
                values: new object[,]
                {
                    { new Guid("a1000000-0000-4000-8000-000000000001"), true, null, new Guid("c1000000-0000-4000-8000-000000000001"), "VIV-0001", 1.05m, new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc), null, "Harina blanca para arepas.", null, "Harina de maíz precocida 1 kg", 1.35m, 120, 0 },
                    { new Guid("a1000000-0000-4000-8000-000000000002"), true, null, new Guid("c1000000-0000-4000-8000-000000000001"), "VIV-0002", 0.92m, new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc), null, "Arroz de grano largo.", null, "Arroz blanco tipo I 1 kg", 1.20m, 150, 0 },
                    { new Guid("a1000000-0000-4000-8000-000000000003"), true, null, new Guid("c1000000-0000-4000-8000-000000000001"), "VIV-0003", 1.18m, new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc), null, "Espagueti de sémola de trigo.", null, "Pasta larga 1 kg", 1.60m, 90, 0 },
                    { new Guid("a1000000-0000-4000-8000-000000000004"), true, null, new Guid("c1000000-0000-4000-8000-000000000001"), "VIV-0004", 2.55m, new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc), null, "Aceite de soya.", null, "Aceite vegetal 1 L", 3.20m, 60, 0 },
                    { new Guid("a1000000-0000-4000-8000-000000000005"), true, null, new Guid("c1000000-0000-4000-8000-000000000002"), "LAC-0001", 1.40m, new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc), null, "Leche de larga duración.", null, "Leche completa UHT 1 L", 1.85m, 80, 0 },
                    { new Guid("a1000000-0000-4000-8000-000000000006"), true, null, new Guid("c1000000-0000-4000-8000-000000000002"), "LAC-0002", 5.10m, new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc), null, "Queso llanero.", null, "Queso blanco duro 1 kg", 6.50m, 25, 0 },
                    { new Guid("a1000000-0000-4000-8000-000000000007"), true, null, new Guid("c1000000-0000-4000-8000-000000000002"), "LAC-0003", 4.70m, new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc), null, "Huevos blancos tamaño AA.", null, "Huevos cartón 30 unidades", 5.90m, 40, 0 },
                    { new Guid("a1000000-0000-4000-8000-000000000008"), true, null, new Guid("c1000000-0000-4000-8000-000000000003"), "BEB-0001", 3.75m, new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc), null, "Tueste medio.", null, "Café molido 500 g", 4.80m, 50, 0 },
                    { new Guid("a1000000-0000-4000-8000-000000000009"), true, null, new Guid("c1000000-0000-4000-8000-000000000003"), "BEB-0002", 1.55m, new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc), null, "Bebida gaseosa.", null, "Refresco de cola 2 L", 2.10m, 70, 0 },
                    { new Guid("a1000000-0000-4000-8000-000000000010"), true, null, new Guid("c1000000-0000-4000-8000-000000000004"), "LIM-0001", 2.60m, new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc), null, "Para ropa blanca y de color.", null, "Detergente en polvo 1 kg", 3.40m, 45, 0 },
                    { new Guid("a1000000-0000-4000-8000-000000000011"), true, null, new Guid("c1000000-0000-4000-8000-000000000004"), "LIM-0002", 0.90m, new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc), null, "Blanqueador y desinfectante.", null, "Cloro 1 L", 1.25m, 65, 0 }
                });

            migrationBuilder.CreateIndex(
                name: "ix_auditoria_creado_en",
                table: "auditoria",
                column: "creado_en");

            migrationBuilder.CreateIndex(
                name: "ix_auditoria_entidad_entidad_id",
                table: "auditoria",
                columns: new[] { "entidad", "entidad_id" });

            migrationBuilder.CreateIndex(
                name: "ix_auditoria_usuario_id",
                table: "auditoria",
                column: "usuario_id");

            migrationBuilder.CreateIndex(
                name: "ix_categorias_nombre",
                table: "categorias",
                column: "nombre",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_historial_estados_pedido_pedido_id",
                table: "historial_estados_pedido",
                column: "pedido_id");

            migrationBuilder.CreateIndex(
                name: "ix_historial_estados_pedido_usuario_id",
                table: "historial_estados_pedido",
                column: "usuario_id");

            migrationBuilder.CreateIndex(
                name: "ix_historial_tasas_usuario_id",
                table: "historial_tasas",
                column: "usuario_id");

            migrationBuilder.CreateIndex(
                name: "ix_mensajes_whatsapp_pedido_id",
                table: "mensajes_whatsapp",
                column: "pedido_id");

            migrationBuilder.CreateIndex(
                name: "ix_movimientos_inventario_pedido_id",
                table: "movimientos_inventario",
                column: "pedido_id");

            migrationBuilder.CreateIndex(
                name: "ix_movimientos_inventario_producto_id_creado_en",
                table: "movimientos_inventario",
                columns: new[] { "producto_id", "creado_en" });

            migrationBuilder.CreateIndex(
                name: "ix_movimientos_inventario_usuario_id",
                table: "movimientos_inventario",
                column: "usuario_id");

            migrationBuilder.CreateIndex(
                name: "ix_notificaciones_leida_creado_en",
                table: "notificaciones",
                columns: new[] { "leida", "creado_en" });

            migrationBuilder.CreateIndex(
                name: "ix_notificaciones_pedido_id",
                table: "notificaciones",
                column: "pedido_id");

            migrationBuilder.CreateIndex(
                name: "ix_notificaciones_producto_id",
                table: "notificaciones",
                column: "producto_id");

            migrationBuilder.CreateIndex(
                name: "ix_pedido_items_categoria_id",
                table: "pedido_items",
                column: "categoria_id");

            migrationBuilder.CreateIndex(
                name: "ix_pedido_items_pedido_id",
                table: "pedido_items",
                column: "pedido_id");

            migrationBuilder.CreateIndex(
                name: "ix_pedido_items_producto_id",
                table: "pedido_items",
                column: "producto_id");

            migrationBuilder.CreateIndex(
                name: "ix_pedidos_cliente_id",
                table: "pedidos",
                column: "cliente_id");

            migrationBuilder.CreateIndex(
                name: "ix_pedidos_estado_creado_en",
                table: "pedidos",
                columns: new[] { "estado", "creado_en" });

            migrationBuilder.CreateIndex(
                name: "ix_pedidos_estado_expira_en",
                table: "pedidos",
                columns: new[] { "estado", "expira_en" });

            migrationBuilder.CreateIndex(
                name: "ix_pedidos_numero",
                table: "pedidos",
                column: "numero",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_pedidos_repartidor_id",
                table: "pedidos",
                column: "repartidor_id");

            migrationBuilder.CreateIndex(
                name: "ix_pedidos_revisado_por_id",
                table: "pedidos",
                column: "revisado_por");

            migrationBuilder.CreateIndex(
                name: "ix_pedidos_zona_id",
                table: "pedidos",
                column: "zona_id");

            migrationBuilder.CreateIndex(
                name: "ix_productos_activo_stock_disponible",
                table: "productos",
                columns: new[] { "activo", "stock_disponible" });

            migrationBuilder.CreateIndex(
                name: "ix_productos_categoria_id",
                table: "productos",
                column: "categoria_id");

            migrationBuilder.CreateIndex(
                name: "ix_productos_codigo_sku",
                table: "productos",
                column: "codigo_sku",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_productos_creado_por_id",
                table: "productos",
                column: "creado_por");

            migrationBuilder.CreateIndex(
                name: "ix_usuarios_email",
                table: "usuarios",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_usuarios_google_id",
                table: "usuarios",
                column: "google_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_zonas_nombre",
                table: "zonas",
                column: "nombre",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "auditoria");

            migrationBuilder.DropTable(
                name: "configuracion");

            migrationBuilder.DropTable(
                name: "historial_estados_pedido");

            migrationBuilder.DropTable(
                name: "historial_tasas");

            migrationBuilder.DropTable(
                name: "mensajes_whatsapp");

            migrationBuilder.DropTable(
                name: "movimientos_inventario");

            migrationBuilder.DropTable(
                name: "notificaciones");

            migrationBuilder.DropTable(
                name: "pedido_items");

            migrationBuilder.DropTable(
                name: "pedidos");

            migrationBuilder.DropTable(
                name: "productos");

            migrationBuilder.DropTable(
                name: "zonas");

            migrationBuilder.DropTable(
                name: "categorias");

            migrationBuilder.DropTable(
                name: "usuarios");
        }
    }
}
