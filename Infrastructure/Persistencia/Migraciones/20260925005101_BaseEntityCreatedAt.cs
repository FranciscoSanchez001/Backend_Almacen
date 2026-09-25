using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistencia.Migraciones
{
    /// <inheritdoc />
    public partial class BaseEntityCreatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "creado_en",
                table: "zonas",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.AddColumn<DateTime>(
                name: "creado_en",
                table: "pedido_items",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.AddColumn<DateTime>(
                name: "creado_en",
                table: "configuracion",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.AddColumn<DateTime>(
                name: "creado_en",
                table: "categorias",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("c1000000-0000-4000-8000-000000000001"),
                column: "creado_en",
                value: new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("c1000000-0000-4000-8000-000000000002"),
                column: "creado_en",
                value: new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("c1000000-0000-4000-8000-000000000003"),
                column: "creado_en",
                value: new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("c1000000-0000-4000-8000-000000000004"),
                column: "creado_en",
                value: new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "zonas",
                keyColumn: "id",
                keyValue: new Guid("e1000000-0000-4000-8000-000000000001"),
                column: "creado_en",
                value: new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "zonas",
                keyColumn: "id",
                keyValue: new Guid("e1000000-0000-4000-8000-000000000002"),
                column: "creado_en",
                value: new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "zonas",
                keyColumn: "id",
                keyValue: new Guid("e1000000-0000-4000-8000-000000000003"),
                column: "creado_en",
                value: new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "zonas",
                keyColumn: "id",
                keyValue: new Guid("e1000000-0000-4000-8000-000000000004"),
                column: "creado_en",
                value: new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "zonas",
                keyColumn: "id",
                keyValue: new Guid("e1000000-0000-4000-8000-000000000005"),
                column: "creado_en",
                value: new DateTime(2026, 9, 23, 0, 0, 0, 0, DateTimeKind.Utc));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "creado_en",
                table: "zonas");

            migrationBuilder.DropColumn(
                name: "creado_en",
                table: "pedido_items");

            migrationBuilder.DropColumn(
                name: "creado_en",
                table: "configuracion");

            migrationBuilder.DropColumn(
                name: "creado_en",
                table: "categorias");
        }
    }
}
