using System;
using Core.Domain.Enums;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistencia.Migraciones
{
    /// <inheritdoc />
    public partial class AnaliticaComportamiento : Migration
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
                .Annotation("Npgsql:Enum:tipo_evento_analitica", "abrir_carrito,agregar_carrito,busqueda,cupon_aplicado,cupon_rechazado,filtro_categoria,filtro_ofertas,inicio_checkout,pagina_vista,pedido_confirmado,quitar_carrito")
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

            migrationBuilder.CreateTable(
                name: "eventos_analitica",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tipo = table.Column<TipoEventoAnalitica>(type: "tipo_evento_analitica", nullable: false),
                    sesion_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    cliente_id = table.Column<Guid>(type: "uuid", nullable: true),
                    producto_id = table.Column<Guid>(type: "uuid", nullable: true),
                    categoria_id = table.Column<Guid>(type: "uuid", nullable: true),
                    texto = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    cantidad = table.Column<int>(type: "integer", nullable: true),
                    valor = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ruta = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    creado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_eventos_analitica", x => x.id);
                    table.ForeignKey(
                        name: "fk_eventos_analitica_usuarios_cliente_id",
                        column: x => x.cliente_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_eventos_analitica_cliente_id",
                table: "eventos_analitica",
                column: "cliente_id");

            migrationBuilder.CreateIndex(
                name: "ix_eventos_analitica_creado_en",
                table: "eventos_analitica",
                column: "creado_en");

            migrationBuilder.CreateIndex(
                name: "ix_eventos_analitica_tipo_creado_en",
                table: "eventos_analitica",
                columns: new[] { "tipo", "creado_en" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "eventos_analitica");

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
                .OldAnnotation("Npgsql:Enum:tipo_cupon", "monto_fijo,porcentaje")
                .OldAnnotation("Npgsql:Enum:tipo_evento_analitica", "abrir_carrito,agregar_carrito,busqueda,cupon_aplicado,cupon_rechazado,filtro_categoria,filtro_ofertas,inicio_checkout,pagina_vista,pedido_confirmado,quitar_carrito")
                .OldAnnotation("Npgsql:Enum:tipo_movimiento_inventario", "ajuste,liberacion,reposicion,reserva,venta")
                .OldAnnotation("Npgsql:Enum:tipo_notificacion", "pedido_nuevo,pedido_por_expirar,stock_agotado");
        }
    }
}
