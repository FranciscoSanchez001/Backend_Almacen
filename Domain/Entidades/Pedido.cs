using Backend_Almacen.Domain.Enums;
using Backend_Almacen.Domain.Reglas;

namespace Backend_Almacen.Domain.Entidades
{
    public class Pedido
    {
        public Guid Id { get; set; }

        // Número correlativo legible (#1, #2...) para el cliente y los mensajes de WhatsApp.
        // Lo genera la base de datos.
        public int Numero { get; set; }

        public Guid ClienteId { get; set; }
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

        public Guid ZonaId { get; set; }
        public Zona Zona { get; set; } = null!;
        public required string DireccionTexto { get; set; }
        public double? Latitud { get; set; }
        public double? Longitud { get; set; }
        public required string TelefonoContacto { get; set; }

        public Guid? RevisadoPorId { get; set; }
        public Usuario? RevisadoPor { get; set; }
        public DateTime? RevisadoEn { get; set; }
        public string? MotivoRechazo { get; set; }

        public Guid? RepartidorId { get; set; }
        public Usuario? Repartidor { get; set; }
        public DateTime? AsignadoEn { get; set; }
        public DateTime? EnCaminoEn { get; set; }
        public DateTime? EntregadoEn { get; set; }

        // creado_en + configuracion.horas_expiracion.
        public DateTime ExpiraEn { get; set; }
        public DateTime CreadoEn { get; set; }

        public List<PedidoItem> Items { get; set; } = [];
        public List<HistorialEstadoPedido> HistorialEstados { get; set; } = [];

        // Toda transición pasa por aquí: valida que sea legal y deja la línea en el historial.
        // usuarioId null = lo hizo el sistema (job de expiración).
        public void CambiarEstado(EstadoPedido nuevo, Guid? usuarioId, DateTime ahora)
        {
            if (!TransicionesPedido.EsLegal(Estado, nuevo))
            {
                throw new InvalidOperationException($"Transición ilegal del pedido {Id}: {Estado} -> {nuevo}.");
            }

            HistorialEstados.Add(new HistorialEstadoPedido
            {
                PedidoId = Id,
                EstadoAnterior = Estado,
                EstadoNuevo = nuevo,
                UsuarioId = usuarioId,
                CreadoEn = ahora,
            });
            Estado = nuevo;
        }

        // Primera línea del historial, al crear el pedido.
        public void RegistrarCreacion(Guid clienteId, DateTime ahora)
        {
            HistorialEstados.Add(new HistorialEstadoPedido
            {
                PedidoId = Id,
                EstadoAnterior = null,
                EstadoNuevo = EstadoPedido.Pendiente,
                UsuarioId = clienteId,
                CreadoEn = ahora,
            });
        }
    }
}
