using Core.Domain.Comun;

namespace Core.Domain.Entidades
{
    public class HistorialTasa : BaseEntity
    {
        public decimal Tasa { get; set; }

        public Guid UsuarioId { get; set; }
        public Usuario Usuario { get; set; } = null!;

    }
}
