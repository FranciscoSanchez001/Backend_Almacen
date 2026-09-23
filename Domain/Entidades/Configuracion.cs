namespace Backend_Almacen.Domain.Entidades
{
    // Tabla de una sola fila, siempre con el mismo Id.
    public class Configuracion
    {
        public static readonly Guid IdUnico = new("00000000-0000-0000-0000-000000000001");

        public Guid Id { get; set; } = IdUnico;

        // Null hasta que el superadmin cargue la primera tasa.
        public decimal? TasaBsUsd { get; set; }
        public string? NumeroSoporte { get; set; }
        public int HorasExpiracion { get; set; } = 5;

        public string? DatosTransferencia { get; set; }
        public string? DatosPagoMovil { get; set; }
        public string? WalletBinance { get; set; }

        // Lista blanca de teléfonos a los que se permite enviar WhatsApp.
        public List<string> NumerosPrueba { get; set; } = [];
    }
}
