using Core.Domain.Comun;

namespace Core.Domain.Entidades
{
    public class Categoria : BaseEntity
    {
        public required string Nombre { get; set; }

        public List<Producto> Productos { get; set; } = [];
    }
}
