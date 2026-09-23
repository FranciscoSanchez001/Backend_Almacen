namespace Backend_Almacen.Models
{
    public class HistorialTasa
    {
        public int Id { get; set; }
        public decimal Tasa { get; set; }

        public int UsuarioId { get; set; }
        public Usuario Usuario { get; set; } = null!;

        public DateTime CreadoEn { get; set; }
    }
}
