using System;
using Core.Domain.Enums;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistencia.Migraciones
{
    /// <inheritdoc />
    public partial class CuponesYOfertas : Migration
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
                .Annotation("Npgsql:Enum:tipo_cupon", "monto_fijo,porcentaje")
                .Annotation("Npgsql:Enum:tipo_movimiento_inventario", "ajuste,liberacion,reposicion,reserva,venta")
                .Annotation("Npgsql:Enum:tipo_notificacion", "pedido_nuevo,pedido_por_expirar,stock_agotado")
                .OldAnnotation("Npgsql:Enum:accion_auditoria", "borrar,crear,descargar_reporte,editar")
                .OldAnnotation("Npgsql:Enum:estado_mensaje_whatsapp", "bloqueado_lista_blanca,enviado,error")
                .OldAnnotation("Npgsql:Enum:estado_pedido", "aprobado,asignado,en_camino,entregado,expirado,pendiente,rechazado")
                .OldAnnotation("Npgsql:Enum:metodo_pago", "binance,pago_movil,transferencia")
                .OldAnnotation("Npgsql:Enum:moneda_pago", "USDT,VES")
                .OldAnnotation("Npgsql:Enum:rol_usuario", "cliente,repartidor,superadmin,ventas")
                .OldAnnotation("Npgsql:Enum:tipo_movimiento_inventario", "ajuste,liberacion,reposicion,reserva,venta")
                .OldAnnotation("Npgsql:Enum:tipo_notificacion", "pedido_nuevo,pedido_por_expirar,stock_agotado");

            migrationBuilder.AddColumn<DateTime>(
                name: "descuento_desde",
                table: "productos",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "descuento_hasta",
                table: "productos",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "descuento_porcentaje",
                table: "productos",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "cupon_id",
                table: "pedidos",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "descuento_bs",
                table: "pedidos",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "descuento_usd",
                table: "pedidos",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "precio_lista_usd",
                table: "pedido_items",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            // Los pedidos anteriores no tenían ofertas: su precio de lista es el que pagaron.
            migrationBuilder.Sql("UPDATE pedido_items SET precio_lista_usd = precio_usd;");

            migrationBuilder.CreateTable(
                name: "cupones",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    codigo = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    descripcion = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    tipo = table.Column<TipoCupon>(type: "tipo_cupon", nullable: false),
                    valor = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    compra_minima_usd = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    valido_desde = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    valido_hasta = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    usos_maximos = table.Column<int>(type: "integer", nullable: true),
                    usos_actuales = table.Column<int>(type: "integer", nullable: false),
                    activo = table.Column<bool>(type: "boolean", nullable: false),
                    creado_por = table.Column<Guid>(type: "uuid", nullable: true),
                    actualizado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    creado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cupones", x => x.id);
                    table.CheckConstraint("ck_cupones_compra_minima", "compra_minima_usd IS NULL OR compra_minima_usd >= 0");
                    table.CheckConstraint("ck_cupones_usos", "usos_actuales >= 0 AND (usos_maximos IS NULL OR usos_actuales <= usos_maximos)");
                    table.CheckConstraint("ck_cupones_valor", "valor > 0 AND (tipo <> 'porcentaje' OR valor <= 100)");
                    table.CheckConstraint("ck_cupones_vigencia", "valido_desde IS NULL OR valido_hasta IS NULL OR valido_hasta > valido_desde");
                    table.ForeignKey(
                        name: "fk_cupones_usuarios_creado_por_id",
                        column: x => x.creado_por,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000001"),
                columns: new[] { "descuento_desde", "descuento_hasta", "descuento_porcentaje" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000002"),
                columns: new[] { "descuento_desde", "descuento_hasta", "descuento_porcentaje" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000003"),
                columns: new[] { "descuento_desde", "descuento_hasta", "descuento_porcentaje" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000004"),
                columns: new[] { "descuento_desde", "descuento_hasta", "descuento_porcentaje" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000005"),
                columns: new[] { "descuento_desde", "descuento_hasta", "descuento_porcentaje" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000006"),
                columns: new[] { "descuento_desde", "descuento_hasta", "descuento_porcentaje" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000007"),
                columns: new[] { "descuento_desde", "descuento_hasta", "descuento_porcentaje" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000008"),
                columns: new[] { "descuento_desde", "descuento_hasta", "descuento_porcentaje" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000009"),
                columns: new[] { "descuento_desde", "descuento_hasta", "descuento_porcentaje" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000010"),
                columns: new[] { "descuento_desde", "descuento_hasta", "descuento_porcentaje" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000011"),
                columns: new[] { "descuento_desde", "descuento_hasta", "descuento_porcentaje" },
                values: new object[] { null, null, null });

            migrationBuilder.AddCheckConstraint(
                name: "ck_productos_descuento",
                table: "productos",
                sql: "descuento_porcentaje IS NULL OR (descuento_porcentaje > 0 AND descuento_porcentaje < 100)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_productos_descuento_vigencia",
                table: "productos",
                sql: "descuento_desde IS NULL OR descuento_hasta IS NULL OR descuento_hasta > descuento_desde");

            migrationBuilder.CreateIndex(
                name: "ux_pedidos_cupon_cliente_vigente",
                table: "pedidos",
                columns: new[] { "cupon_id", "cliente_id" },
                unique: true,
                filter: "cupon_id IS NOT NULL AND estado NOT IN ('rechazado', 'expirado')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_pedidos_descuento",
                table: "pedidos",
                sql: "descuento_usd >= 0 AND descuento_bs >= 0");

            migrationBuilder.CreateIndex(
                name: "ix_cupones_codigo",
                table: "cupones",
                column: "codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_cupones_creado_por_id",
                table: "cupones",
                column: "creado_por");

            migrationBuilder.AddForeignKey(
                name: "fk_pedidos_cupones_cupon_id",
                table: "pedidos",
                column: "cupon_id",
                principalTable: "cupones",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_pedidos_cupones_cupon_id",
                table: "pedidos");

            migrationBuilder.DropTable(
                name: "cupones");

            migrationBuilder.DropCheckConstraint(
                name: "ck_productos_descuento",
                table: "productos");

            migrationBuilder.DropCheckConstraint(
                name: "ck_productos_descuento_vigencia",
                table: "productos");

            migrationBuilder.DropIndex(
                name: "ux_pedidos_cupon_cliente_vigente",
                table: "pedidos");

            migrationBuilder.DropCheckConstraint(
                name: "ck_pedidos_descuento",
                table: "pedidos");

            migrationBuilder.DropColumn(
                name: "descuento_desde",
                table: "productos");

            migrationBuilder.DropColumn(
                name: "descuento_hasta",
                table: "productos");

            migrationBuilder.DropColumn(
                name: "descuento_porcentaje",
                table: "productos");

            migrationBuilder.DropColumn(
                name: "cupon_id",
                table: "pedidos");

            migrationBuilder.DropColumn(
                name: "descuento_bs",
                table: "pedidos");

            migrationBuilder.DropColumn(
                name: "descuento_usd",
                table: "pedidos");

            migrationBuilder.DropColumn(
                name: "precio_lista_usd",
                table: "pedido_items");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:accion_auditoria", "borrar,crear,descargar_reporte,editar")
                .Annotation("Npgsql:Enum:estado_mensaje_whatsapp", "bloqueado_lista_blanca,enviado,error")
                .Annotation("Npgsql:Enum:estado_pedido", "aprobado,asignado,en_camino,entregado,expirado,pendiente,rechazado")
                .Annotation("Npgsql:Enum:metodo_pago", "binance,pago_movil,transferencia")
                .Annotation("Npgsql:Enum:moneda_pago", "USDT,VES")
                .Annotation("Npgsql:Enum:rol_usuario", "cliente,repartidor,superadmin,ventas")
                .Annotation("Npgsql:Enum:tipo_movimiento_inventario", "ajuste,liberacion,reposicion,reserva,venta")
                .Annotation("Npgsql:Enum:tipo_notificacion", "pedido_nuevo,pedido_por_expirar,stock_agotado")
                .OldAnnotation("Npgsql:Enum:accion_auditoria", "borrar,crear,descargar_reporte,editar")
                .OldAnnotation("Npgsql:Enum:estado_mensaje_whatsapp", "bloqueado_lista_blanca,enviado,error")
                .OldAnnotation("Npgsql:Enum:estado_pedido", "aprobado,asignado,en_camino,entregado,expirado,pendiente,rechazado")
                .OldAnnotation("Npgsql:Enum:metodo_pago", "binance,pago_movil,transferencia")
                .OldAnnotation("Npgsql:Enum:moneda_pago", "USDT,VES")
                .OldAnnotation("Npgsql:Enum:rol_usuario", "cliente,repartidor,superadmin,ventas")
                .OldAnnotation("Npgsql:Enum:tipo_cupon", "monto_fijo,porcentaje")
                .OldAnnotation("Npgsql:Enum:tipo_movimiento_inventario", "ajuste,liberacion,reposicion,reserva,venta")
                .OldAnnotation("Npgsql:Enum:tipo_notificacion", "pedido_nuevo,pedido_por_expirar,stock_agotado");
        }
    }
}
