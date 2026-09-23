namespace Backend_Almacen.Domain.Entidades
{
    public class HistorialTasa
    {
        public Guid Id { get; set; }
        public decimal Tasa { get; set; }

        public Guid UsuarioId { get; set; }
        public Usuario Usuario { get; set; } = null!;

        public DateTime CreadoEn { get; set; }
    }
}
