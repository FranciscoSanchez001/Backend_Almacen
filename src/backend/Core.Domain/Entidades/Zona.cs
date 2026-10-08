using Core.Domain.Comun;

namespace Core.Domain.Entidades
{
    // Zona de entrega; el superadmin mantiene la lista.
    public class Zona : BaseEntity
    {
        public required string Nombre { get; set; }
        public bool Activa { get; set; } = true;
    }
}
