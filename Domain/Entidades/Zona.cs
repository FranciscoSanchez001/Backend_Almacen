namespace Backend_Almacen.Domain.Entidades
{
    // Zona de entrega; el superadmin mantiene la lista.
    public class Zona
    {
        public Guid Id { get; set; }
        public required string Nombre { get; set; }
        public bool Activa { get; set; } = true;
    }
}
