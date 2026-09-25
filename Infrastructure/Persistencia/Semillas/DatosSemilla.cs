using Core.Domain.Entidades;

namespace Infrastructure.Persistencia.Semillas
{
    // Datos maestros iniciales del supermercado. Se aplican con HasData() desde las
    // configuraciones, así que quedan dentro de la migración y se insertan con
    // `dotnet ef database update`. Los Id son fijos para que EF pueda compararlos entre migraciones.
    public static class DatosSemilla
    {
        private static readonly DateTime Fecha = new(2026, 9, 23, 0, 0, 0, DateTimeKind.Utc);

        public static readonly Guid Viveres = new("c1000000-0000-4000-8000-000000000001");
        public static readonly Guid LacteosHuevos = new("c1000000-0000-4000-8000-000000000002");
        public static readonly Guid Bebidas = new("c1000000-0000-4000-8000-000000000003");
        public static readonly Guid Limpieza = new("c1000000-0000-4000-8000-000000000004");

        public static Categoria[] Categorias =>
        [
            new() { Id = Viveres, Nombre = "Víveres", CreatedAt = Fecha },
            new() { Id = LacteosHuevos, Nombre = "Lácteos y huevos", CreatedAt = Fecha },
            new() { Id = Bebidas, Nombre = "Bebidas", CreatedAt = Fecha },
            new() { Id = Limpieza, Nombre = "Limpieza del hogar", CreatedAt = Fecha },
        ];

        public static Producto[] Productos =>
        [
            P(1, "VIV-0001", "Harina de maíz precocida 1 kg", "Harina blanca para arepas.", 1.35m, 1.05m, Viveres, 120),
            P(2, "VIV-0002", "Arroz blanco tipo I 1 kg", "Arroz de grano largo.", 1.20m, 0.92m, Viveres, 150),
            P(3, "VIV-0003", "Pasta larga 1 kg", "Espagueti de sémola de trigo.", 1.60m, 1.18m, Viveres, 90),
            P(4, "VIV-0004", "Aceite vegetal 1 L", "Aceite de soya.", 3.20m, 2.55m, Viveres, 60),
            P(5, "LAC-0001", "Leche completa UHT 1 L", "Leche de larga duración.", 1.85m, 1.40m, LacteosHuevos, 80),
            P(6, "LAC-0002", "Queso blanco duro 1 kg", "Queso llanero.", 6.50m, 5.10m, LacteosHuevos, 25),
            P(7, "LAC-0003", "Huevos cartón 30 unidades", "Huevos blancos tamaño AA.", 5.90m, 4.70m, LacteosHuevos, 40),
            P(8, "BEB-0001", "Café molido 500 g", "Tueste medio.", 4.80m, 3.75m, Bebidas, 50),
            P(9, "BEB-0002", "Refresco de cola 2 L", "Bebida gaseosa.", 2.10m, 1.55m, Bebidas, 70),
            P(10, "LIM-0001", "Detergente en polvo 1 kg", "Para ropa blanca y de color.", 3.40m, 2.60m, Limpieza, 45),
            P(11, "LIM-0002", "Cloro 1 L", "Blanqueador y desinfectante.", 1.25m, 0.90m, Limpieza, 65),
        ];

        public static Zona[] Zonas =>
        [
            Z(1, "Centro"),
            Z(2, "Barrio Obrero"),
            Z(3, "Pueblo Nuevo"),
            Z(4, "La Concordia"),
            Z(5, "Santa Teresa"),
        ];

        private static Producto P(int n, string sku, string nombre, string descripcion, decimal precio, decimal costo,
            Guid categoriaId, int stock) => new()
        {
            Id = new Guid($"a1000000-0000-4000-8000-{n:D12}"),
            CodigoSku = sku,
            Nombre = nombre,
            Descripcion = descripcion,
            PrecioUsd = precio,
            CostoUsd = costo,
            CategoriaId = categoriaId,
            StockDisponible = stock,
            StockReservado = 0,
            Activo = true,
            CreatedAt = Fecha,
        };

        private static Zona Z(int n, string nombre) => new()
        {
            Id = new Guid($"e1000000-0000-4000-8000-{n:D12}"),
            Nombre = nombre,
            Activa = true,
            CreatedAt = Fecha,
        };
    }
}
