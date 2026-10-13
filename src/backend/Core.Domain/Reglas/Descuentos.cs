namespace Core.Domain.Reglas
{
    // Cálculos de descuento compartidos por las ofertas de producto y los cupones. Todos los
    // montos van en USD y se redondean a 2 decimales, igual que los precios.
    public static class Descuentos
    {
        // Precio con un % de descuento (ofertas de producto).
        public static decimal AplicarPorcentaje(decimal precio, decimal porcentaje) =>
            Redondear(precio * (100 - porcentaje) / 100);

        // Monto que descuenta un % sobre un subtotal (cupones de porcentaje).
        public static decimal MontoPorcentaje(decimal subtotal, decimal porcentaje) =>
            Redondear(subtotal * porcentaje / 100);

        // Vigencia [desde, hasta): null en cualquiera de los extremos = sin límite por ese lado.
        public static bool EstaVigente(DateTime? desde, DateTime? hasta, DateTime ahora) =>
            (desde is null || desde <= ahora) && (hasta is null || ahora < hasta);

        public static decimal Redondear(decimal monto) => Math.Round(monto, 2, MidpointRounding.AwayFromZero);
    }
}
