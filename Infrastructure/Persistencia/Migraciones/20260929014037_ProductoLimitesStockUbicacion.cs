using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistencia.Migraciones
{
    /// <inheritdoc />
    public partial class ProductoLimitesStockUbicacion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "stock_maximo",
                table: "productos",
                type: "integer",
                nullable: false,
                defaultValue: 100);

            migrationBuilder.AddColumn<int>(
                name: "stock_minimo",
                table: "productos",
                type: "integer",
                nullable: false,
                defaultValue: 5);

            migrationBuilder.AddColumn<string>(
                name: "ubicacion",
                table: "productos",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "unidad_medida",
                table: "productos",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "unidad");

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000001"),
                columns: new[] { "stock_maximo", "stock_minimo", "ubicacion", "unidad_medida" },
                values: new object[] { 200, 20, "P1-E1", "paquete" });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000002"),
                columns: new[] { "stock_maximo", "stock_minimo", "ubicacion", "unidad_medida" },
                values: new object[] { 200, 20, "P1-E2", "paquete" });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000003"),
                columns: new[] { "stock_maximo", "stock_minimo", "ubicacion", "unidad_medida" },
                values: new object[] { 150, 10, "P1-E3", "paquete" });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000004"),
                columns: new[] { "stock_maximo", "stock_minimo", "ubicacion", "unidad_medida" },
                values: new object[] { 100, 10, "P1-E4", "botella" });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000005"),
                columns: new[] { "stock_maximo", "stock_minimo", "ubicacion", "unidad_medida" },
                values: new object[] { 120, 10, "R1-N1", "caja" });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000006"),
                columns: new[] { "stock_maximo", "stock_minimo", "ubicacion", "unidad_medida" },
                values: new object[] { 40, 5, "R1-N2", "kg" });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000007"),
                columns: new[] { "stock_maximo", "stock_minimo", "ubicacion", "unidad_medida" },
                values: new object[] { 60, 5, "R1-N3", "cartón" });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000008"),
                columns: new[] { "stock_maximo", "stock_minimo", "ubicacion", "unidad_medida" },
                values: new object[] { 80, 5, "P2-E1", "paquete" });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000009"),
                columns: new[] { "stock_maximo", "stock_minimo", "ubicacion", "unidad_medida" },
                values: new object[] { 100, 10, "P2-E2", "botella" });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000010"),
                columns: new[] { "stock_maximo", "stock_minimo", "ubicacion", "unidad_medida" },
                values: new object[] { 80, 5, "P3-E1", "bolsa" });

            migrationBuilder.UpdateData(
                table: "productos",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-4000-8000-000000000011"),
                columns: new[] { "stock_maximo", "stock_minimo", "ubicacion", "unidad_medida" },
                values: new object[] { 100, 10, "P3-E2", "botella" });

            migrationBuilder.AddCheckConstraint(
                name: "ck_productos_stock_maximo",
                table: "productos",
                sql: "stock_maximo > stock_minimo");

            migrationBuilder.AddCheckConstraint(
                name: "ck_productos_stock_minimo",
                table: "productos",
                sql: "stock_minimo >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_productos_stock_maximo",
                table: "productos");

            migrationBuilder.DropCheckConstraint(
                name: "ck_productos_stock_minimo",
                table: "productos");

            migrationBuilder.DropColumn(
                name: "stock_maximo",
                table: "productos");

            migrationBuilder.DropColumn(
                name: "stock_minimo",
                table: "productos");

            migrationBuilder.DropColumn(
                name: "ubicacion",
                table: "productos");

            migrationBuilder.DropColumn(
                name: "unidad_medida",
                table: "productos");
        }
    }
}
