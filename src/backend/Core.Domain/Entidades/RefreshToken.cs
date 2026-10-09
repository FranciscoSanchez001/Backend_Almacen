using Core.Domain.Comun;

namespace Core.Domain.Entidades
{
    // Refresh token de una sesión. Solo se guarda el hash SHA-256: el valor en claro lo tiene
    // únicamente el cliente. Cada uso lo revoca y emite uno nuevo (rotación); si llega uno ya
    // revocado, se asume robo y se revocan todos los del usuario.
    public class RefreshToken : BaseEntity
    {
        public Guid UsuarioId { get; set; }
        public Usuario Usuario { get; set; } = null!;

        public required string TokenHash { get; set; }
        public DateTime ExpiraEn { get; set; }

        public DateTime? RevocadoEn { get; set; }

        // Token que lo reemplazó al rotar; null si se revocó por logout o por reutilización.
        public Guid? ReemplazadoPorId { get; set; }

        public bool EstaActivo(DateTime ahora) => RevocadoEn is null && ExpiraEn > ahora;
    }
}
