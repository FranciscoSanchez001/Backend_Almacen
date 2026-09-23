namespace Backend_Almacen.Models
{
    // Tabla de una sola fila (Id siempre 1).
    public class Configuracion
    {
        public int Id { get; set; }

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
