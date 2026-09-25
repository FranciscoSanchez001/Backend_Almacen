namespace Core.Domain.Comun
{
    // Clase base de todas las entidades: clave primaria UUID y fecha de creación en UTC.
    // En la base de datos CreatedAt se guarda en la columna creado_en (timestamptz, default now()),
    // configurada una sola vez para todas las entidades en ApplicationDbContext.
    public abstract class BaseEntity
    {
        public Guid Id { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
