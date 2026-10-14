namespace Core.Domain.Reglas
{
    // Nivel de ocupación del espacio de almacén (KPI de logística). No se guarda en la base: se
    // calcula a partir del stock y de la capacidad (StockMaximo) de cada producto.
    public enum NivelOcupacion
    {
        Baja,
        Optima,
        Alta,
        Saturada
    }

    // Ocupación = unidades en el almacén ÷ capacidad × 100. Las unidades incluyen el stock
    // reservado, que sigue físicamente en el almacén hasta que el pedido sale a entregarse.
    public static class OcupacionAlmacen
    {
        public const decimal LimiteBaja = 20;
        public const decimal LimiteAlta = 85;
        public const decimal LimiteSaturada = 100;

        // Null si no hay capacidad (no se puede dividir entre 0).
        public static decimal? Porcentaje(int unidades, int capacidad) =>
            capacidad <= 0 ? null : Math.Round(unidades * 100m / capacidad, 1, MidpointRounding.AwayFromZero);

        // < 20 % baja, 20–85 % óptima, 85–100 % alta y > 100 % saturada (por encima de la capacidad).
        public static NivelOcupacion Clasificar(decimal porcentaje) => porcentaje switch
        {
            > LimiteSaturada => NivelOcupacion.Saturada,
            >= LimiteAlta => NivelOcupacion.Alta,
            >= LimiteBaja => NivelOcupacion.Optima,
            _ => NivelOcupacion.Baja,
        };
    }
}
