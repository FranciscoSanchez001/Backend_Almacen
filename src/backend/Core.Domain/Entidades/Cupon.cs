using Core.Domain.Comun;
using Core.Domain.Enums;
using Core.Domain.Reglas;

namespace Core.Domain.Entidades
{
    // Cupón de descuento sobre el subtotal del pedido (ya con las ofertas de producto aplicadas).
    // Cada cliente puede usarlo una sola vez; si su pedido se rechaza o expira, el uso se devuelve.
    public class Cupon : BaseEntity
    {
        // Lo que escribe el cliente en el checkout. Siempre en mayúsculas; no cambia después de creado.
        public required string Codigo { get; set; }
        public string? Descripcion { get; set; }

        public TipoCupon Tipo { get; set; }

        // Porcentaje (0-100] o monto en USD, según el tipo.
        public decimal Valor { get; set; }

        // Subtotal mínimo en USD para poder usarlo. Null = sin mínimo.
        public decimal? CompraMinimaUsd { get; set; }

        // Vigencia [desde, hasta). Null = sin límite por ese lado.
        public DateTime? ValidoDesde { get; set; }
        public DateTime? ValidoHasta { get; set; }

        // Usos en total entre todos los clientes. Null = ilimitado. UsosActuales cuenta los pedidos
        // vigentes (pendientes o vendidos) que lo usan.
        public int? UsosMaximos { get; set; }
        public int UsosActuales { get; set; }

        public bool Activo { get; set; } = true;

        public Guid? CreadoPorId { get; set; }
        public Usuario? CreadoPor { get; set; }

        public DateTime? ActualizadoEn { get; set; }

        public static string NormalizarCodigo(string codigo) => codigo.Trim().ToUpperInvariant();

        // Monto en USD que descuenta sobre el subtotal. Nunca deja el total por debajo de 0.
        public decimal CalcularDescuento(decimal subtotalUsd) => Tipo switch
        {
            TipoCupon.Porcentaje => Math.Min(Descuentos.MontoPorcentaje(subtotalUsd, Valor), subtotalUsd),
            TipoCupon.MontoFijo => Math.Min(Valor, subtotalUsd),
            _ => throw new ArgumentOutOfRangeException(nameof(Tipo)),
        };

        // Motivo por el que no se puede usar, o null si se puede. No revisa el uso por cliente
        // (eso depende de los pedidos guardados).
        public string? MotivoNoAplicable(decimal subtotalUsd, DateTime ahora)
        {
            if (!Activo)
            {
                return "El cupón no está activo.";
            }
            if (ValidoDesde is not null && ahora < ValidoDesde)
            {
                return "El cupón todavía no está vigente.";
            }
            if (ValidoHasta is not null && ahora >= ValidoHasta)
            {
                return "El cupón ya venció.";
            }
            if (UsosMaximos is not null && UsosActuales >= UsosMaximos)
            {
                return "El cupón ya alcanzó su límite de usos.";
            }
            if (CompraMinimaUsd is not null && subtotalUsd < CompraMinimaUsd)
            {
                return $"El cupón requiere una compra mínima de ${CompraMinimaUsd:0.00}.";
            }
            return null;
        }
    }
}
