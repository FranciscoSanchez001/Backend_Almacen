using System;
using System.Collections.Generic;
using Backend_Almacen.Models;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend_Almacen.Data.Migrations
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
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
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
                    id = table.Column<int>(type: "integer", nullable: false),
                    tasa_bs_usd = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: true),
                    numero_soporte = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    horas_expiracion = table.Column<int>(type: "integer", nullable: false, defaultValue: 5),
                    datos_transferencia = table.Column<string>(type: "text", nullable: true),
                    datos_pago_movil = table.Column<string>(type: "text", nullable: true),
                    wallet_binance = table.Column<string>(type: "text", nullable: true),
                    numeros_prueba = table.Column<List<string>>(type: "text[]", nullable: false, defaultValueSql: "'{}'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_configuracion", x => x.id);
                    table.CheckConstraint("ck_configuracion_horas_expiracion", "horas_expiracion > 0");
                    table.CheckConstraint("ck_configuracion_una_fila", "id = 1");
                });

            migrationBuilder.CreateTable(
                name: "usuarios",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    nombre = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    telefono = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    rol = table.Column<RolUsuario>(type: "rol_usuario", nullable: false),
                    google_id = table.Column<string>(type: "text", nullable: true),
                    password_hash = table.Column<string>(type: "text", nullable: true),
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
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
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
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    entidad = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    entidad_id = table.Column<int>(type: "integer", nullable: true),
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
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    tasa = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
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
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    descripcion = table.Column<string>(type: "text", nullable: true),
                    precio_usd = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    imagen_url = table.Column<string>(type: "text", nullable: true),
                    categoria_id = table.Column<int>(type: "integer", nullable: false),
                    stock_disponible = table.Column<int>(type: "integer", nullable: false),
                    stock_reservado = table.Column<int>(type: "integer", nullable: false),
                    activo = table.Column<bool>(type: "boolean", nullable: false),
                    creado_por = table.Column<int>(type: "integer", nullable: true),
                    creado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    actualizado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_productos", x => x.id);
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
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    cliente_id = table.Column<int>(type: "integer", nullable: false),
                    estado = table.Column<EstadoPedido>(type: "estado_pedido", nullable: false),
                    metodo_pago = table.Column<MetodoPago>(type: "metodo_pago", nullable: false),
                    moneda_pago = table.Column<MonedaPago>(type: "moneda_pago", nullable: false),
                    tasa_cambio = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false),
                    total_usd = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    total_bs = table.Column<decimal>(type: "numeric(16,2)", precision: 16, scale: 2, nullable: false),
                    referencia_pago = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    captura_url = table.Column<string>(type: "text", nullable: true),
                    zona_id = table.Column<int>(type: "integer", nullable: false),
                    direccion_texto = table.Column<string>(type: "text", nullable: false),
                    latitud = table.Column<double>(type: "double precision", nullable: true),
                    longitud = table.Column<double>(type: "double precision", nullable: true),
                    telefono_contacto = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    revisado_por = table.Column<int>(type: "integer", nullable: true),
                    revisado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    motivo_rechazo = table.Column<string>(type: "text", nullable: true),
                    repartidor_id = table.Column<int>(type: "integer", nullable: true),
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
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    pedido_id = table.Column<int>(type: "integer", nullable: false),
                    estado_anterior = table.Column<EstadoPedido>(type: "estado_pedido", nullable: true),
                    estado_nuevo = table.Column<EstadoPedido>(type: "estado_pedido", nullable: false),
                    usuario_id = table.Column<int>(type: "integer", nullable: true),
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
                        onDelete: ReferentialAction.Cascade);
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
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    pedido_id = table.Column<int>(type: "integer", nullable: false),
                    telefono = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    plantilla = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    texto = table.Column<string>(type: "text", nullable: false),
                    estado = table.Column<EstadoMensajeWhatsapp>(type: "estado_mensaje_whatsapp", nullable: false),
                    error = table.Column<string>(type: "text", nullable: true),
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
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    producto_id = table.Column<int>(type: "integer", nullable: false),
                    pedido_id = table.Column<int>(type: "integer", nullable: true),
                    usuario_id = table.Column<int>(type: "integer", nullable: true),
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
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    tipo = table.Column<TipoNotificacion>(type: "tipo_notificacion", nullable: false),
                    producto_id = table.Column<int>(type: "integer", nullable: true),
                    pedido_id = table.Column<int>(type: "integer", nullable: true),
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
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    pedido_id = table.Column<int>(type: "integer", nullable: false),
                    producto_id = table.Column<int>(type: "integer", nullable: false),
                    categoria_id = table.Column<int>(type: "integer", nullable: false),
                    cantidad = table.Column<int>(type: "integer", nullable: false),
                    precio_usd = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    precio_bs = table.Column<decimal>(type: "numeric(16,2)", precision: 16, scale: 2, nullable: false)
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
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_pedido_items_productos_producto_id",
                        column: x => x.producto_id,
                        principalTable: "productos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            // Fila única de configuración; el resto de columnas toma sus valores por defecto.
            migrationBuilder.Sql("INSERT INTO configuracion (id) VALUES (1);");

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
                name: "ix_productos_categoria_id",
                table: "productos",
                column: "categoria_id");

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
