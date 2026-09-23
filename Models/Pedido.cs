namespace Backend_Almacen.Models
{
    public class Pedido
    {
        public int Id { get; set; }

        public int ClienteId { get; set; }
        public Usuario Cliente { get; set; } = null!;

        public EstadoPedido Estado { get; set; } = EstadoPedido.Pendiente;
        public MetodoPago MetodoPago { get; set; }
        public MonedaPago MonedaPago { get; set; }

        // Tasa Bs/USD congelada al crear el pedido.
        public decimal TasaCambio { get; set; }
        public decimal TotalUsd { get; set; }
        public decimal TotalBs { get; set; }

        public string? ReferenciaPago { get; set; }
        public string? CapturaUrl { get; set; }

        public int ZonaId { get; set; }
        public Zona Zona { get; set; } = null!;
        public required string DireccionTexto { get; set; }
        public double? Latitud { get; set; }
        public double? Longitud { get; set; }
        public required string TelefonoContacto { get; set; }

        public int? RevisadoPorId { get; set; }
        public Usuario? RevisadoPor { get; set; }
        public DateTime? RevisadoEn { get; set; }
        public string? MotivoRechazo { get; set; }

        public int? RepartidorId { get; set; }
        public Usuario? Repartidor { get; set; }
        public DateTime? AsignadoEn { get; set; }
        public DateTime? EnCaminoEn { get; set; }
        public DateTime? EntregadoEn { get; set; }

        // creado_en + configuracion.horas_expiracion; lo calcula la aplicación.
        public DateTime ExpiraEn { get; set; }
        public DateTime CreadoEn { get; set; }

        public List<PedidoItem> Items { get; set; } = [];
        public List<HistorialEstadoPedido> HistorialEstados { get; set; } = [];
    }
}
