namespace Backend_Almacen.Domain.Entidades
{
    public class Categoria
    {
        public Guid Id { get; set; }
        public required string Nombre { get; set; }

        public List<Producto> Productos { get; set; } = [];
    }
}
