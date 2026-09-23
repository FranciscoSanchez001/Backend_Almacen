namespace Backend_Almacen.Models
{
    public class Zona
    {
        public int Id { get; set; }
        public required string Nombre { get; set; }
        public bool Activa { get; set; } = true;
    }
}
