namespace Backend_Almacen.Infrastructure.Persistencia.Semillas
{
    // Productos extra de la siembra de demostración (SembradorDemo). Se escriben a mano, no con
    // Bogus, para que sean coherentes con un supermercado venezolano.
    internal static class CatalogoDemo
    {
        public record ProductoDemo(string Sku, string Nombre, string Descripcion, decimal PrecioUsd, decimal CostoUsd, Guid CategoriaId);

        public static readonly ProductoDemo[] Productos =
        [
            new("VIV-0005", "Azúcar refinada 1 kg", "Azúcar blanca refinada.", 1.40m, 1.05m, DatosSemilla.Viveres),
            new("VIV-0006", "Caraotas negras 500 g", "Granos seleccionados.", 1.30m, 0.95m, DatosSemilla.Viveres),
            new("VIV-0007", "Sal refinada 1 kg", "Sal yodada y fluorada.", 0.60m, 0.40m, DatosSemilla.Viveres),
            new("VIV-0008", "Atún en aceite 170 g", "Lomitos de atún.", 1.90m, 1.40m, DatosSemilla.Viveres),
            new("VIV-0009", "Sardinas en salsa de tomate 170 g", "Sardinas en lata.", 1.10m, 0.80m, DatosSemilla.Viveres),
            new("VIV-0010", "Salsa de tomate 397 g", "Salsa tipo ketchup.", 1.75m, 1.25m, DatosSemilla.Viveres),
            new("VIV-0011", "Mayonesa 445 g", "Mayonesa en frasco.", 3.10m, 2.35m, DatosSemilla.Viveres),
            new("VIV-0012", "Avena en hojuelas 400 g", "Avena integral.", 1.60m, 1.15m, DatosSemilla.Viveres),
            new("VIV-0013", "Lentejas 500 g", "Lentejas seleccionadas.", 1.35m, 0.98m, DatosSemilla.Viveres),
            new("VIV-0014", "Margarina 500 g", "Margarina con sal.", 2.40m, 1.80m, DatosSemilla.Viveres),
            new("LAC-0004", "Yogurt natural 1 L", "Yogurt líquido sin azúcar.", 3.20m, 2.40m, DatosSemilla.LacteosHuevos),
            new("LAC-0005", "Queso amarillo rebanado 250 g", "Queso tipo gouda.", 3.80m, 2.90m, DatosSemilla.LacteosHuevos),
            new("LAC-0006", "Mantequilla 250 g", "Mantequilla con sal.", 3.50m, 2.70m, DatosSemilla.LacteosHuevos),
            new("LAC-0007", "Leche en polvo completa 400 g", "Leche en polvo instantánea.", 5.60m, 4.40m, DatosSemilla.LacteosHuevos),
            new("LAC-0008", "Nata 250 g", "Nata para untar.", 1.90m, 1.40m, DatosSemilla.LacteosHuevos),
            new("BEB-0003", "Agua mineral 1,5 L", "Agua mineral sin gas.", 0.90m, 0.55m, DatosSemilla.Bebidas),
            new("BEB-0004", "Jugo de naranja 1 L", "Jugo pasteurizado.", 2.30m, 1.70m, DatosSemilla.Bebidas),
            new("BEB-0005", "Malta 355 ml", "Bebida de malta.", 0.85m, 0.60m, DatosSemilla.Bebidas),
            new("BEB-0006", "Té frío de limón 1,5 L", "Té listo para tomar.", 1.80m, 1.30m, DatosSemilla.Bebidas),
            new("BEB-0007", "Cerveza en lata 355 ml (6 unidades)", "Six-pack de cerveza tipo pilsen.", 6.50m, 5.00m, DatosSemilla.Bebidas),
            new("LIM-0003", "Jabón de tocador (3 unidades)", "Jabón en barra.", 2.20m, 1.60m, DatosSemilla.Limpieza),
            new("LIM-0004", "Lavaplatos en crema 500 g", "Lavaplatos aroma limón.", 1.70m, 1.20m, DatosSemilla.Limpieza),
            new("LIM-0005", "Papel higiénico (4 rollos)", "Papel doble hoja.", 2.60m, 1.95m, DatosSemilla.Limpieza),
            new("LIM-0006", "Desinfectante lavanda 1 L", "Desinfectante multiuso.", 2.10m, 1.50m, DatosSemilla.Limpieza),
            new("LIM-0007", "Suavizante de ropa 1 L", "Suavizante concentrado.", 2.90m, 2.15m, DatosSemilla.Limpieza),
        ];

        // Qué tanto se vende cada producto (relativo; 3 si no aparece). Los básicos se venden más.
        public static readonly Dictionary<string, double> Popularidad = new()
        {
            ["VIV-0001"] = 10, ["VIV-0002"] = 9, ["LAC-0003"] = 8, ["LAC-0001"] = 7, ["BEB-0001"] = 7,
            ["VIV-0004"] = 6, ["VIV-0005"] = 6, ["VIV-0003"] = 5, ["LIM-0005"] = 5, ["BEB-0005"] = 4.5,
            ["LAC-0002"] = 4, ["VIV-0006"] = 4, ["BEB-0003"] = 4, ["LIM-0001"] = 3.5, ["VIV-0014"] = 3.5,
            ["VIV-0007"] = 1.5, ["LAC-0008"] = 1, ["BEB-0007"] = 1.5, ["VIV-0011"] = 2, ["LIM-0007"] = 1.2,
        };

        // Coordenadas aproximadas de las zonas sembradas (San Cristóbal, Táchira).
        public static readonly Dictionary<string, (double Lat, double Lng, double Peso)> Zonas = new()
        {
            ["Centro"] = (7.7669, -72.2250, 30),
            ["Barrio Obrero"] = (7.7775, -72.2140, 20),
            ["Pueblo Nuevo"] = (7.7880, -72.2050, 20),
            ["La Concordia"] = (7.7520, -72.2280, 15),
            ["Santa Teresa"] = (7.7600, -72.2170, 15),
        };

        public static readonly string[] Vias =
            ["Calle {0}", "Carrera {0}", "Vereda {0}", "Avenida Ferrero Tamayo", "Avenida Carabobo", "Avenida 19 de Abril",
             "Avenida Libertador", "Avenida Rotaria", "Avenida España", "Avenida Guayana", "Pasaje {0}"];

        public static readonly string[] Referencias =
            ["frente a la panadería", "al lado de la farmacia", "diagonal a la plaza", "portón negro", "casa de rejas blancas",
             "cerca de la escuela", "detrás de la iglesia", "a media cuadra del abasto", "edificio color crema", "al lado del taller"];

        public static readonly string[] MotivosRechazo =
            ["el método de pago no procede", "el método de pago no procede", "el método de pago no procede",
             "la referencia de pago no coincide", "el monto transferido está incompleto"];
    }
}
