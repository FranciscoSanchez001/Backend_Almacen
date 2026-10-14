using Core.Domain.Comun;
using Core.Domain.Enums;

namespace Core.Domain.Entidades
{
    // Algo que hizo un visitante en la tienda (buscar, agregar al carrito, iniciar el checkout...).
    // Es anónimo: SesionId es un identificador aleatorio que genera el navegador por visita; no se
    // guarda la IP ni datos personales. ClienteId solo se llena si el visitante había iniciado sesión.
    public class EventoAnalitica : BaseEntity
    {
        public TipoEventoAnalitica Tipo { get; set; }
        public required string SesionId { get; set; }

        public Guid? ClienteId { get; set; }
        public Usuario? Cliente { get; set; }

        // Según el tipo. Sin clave foránea: llegan del navegador y no deben hacer fallar el registro.
        public Guid? ProductoId { get; set; }
        public Guid? CategoriaId { get; set; }

        // Búsqueda (normalizada en minúsculas) o código del cupón.
        public string? Texto { get; set; }

        // Unidades agregadas o quitadas del carrito, o resultados de una búsqueda.
        public int? Cantidad { get; set; }

        // Total en USD del pedido confirmado.
        public decimal? Valor { get; set; }

        // Ruta de la tienda (/, /checkout...). Solo en PaginaVista.
        public string? Ruta { get; set; }
    }
}
