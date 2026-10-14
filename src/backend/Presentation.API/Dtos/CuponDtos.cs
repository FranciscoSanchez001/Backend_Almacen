using Core.Domain.Entidades;
using Core.Domain.Enums;

namespace Presentation.API.Dtos
{
    // Los DTOs de entrada están en Core.Application.Dtos junto a sus validadores.

    // Vigente: activo, dentro de sus fechas y con usos disponibles en este momento.
    public record CuponResponse(
        Guid Id,
        string Codigo,
        string? Descripcion,
        TipoCupon Tipo,
        decimal Valor,
        decimal? CompraMinimaUsd,
        DateTime? ValidoDesde,
        DateTime? ValidoHasta,
        int? UsosMaximos,
        int UsosActuales,
        bool Activo,
        bool Vigente,
        DateTime CreadoEn,
        DateTime? ActualizadoEn)
    {
        public static CuponResponse De(Cupon c) => new(
            c.Id, c.Codigo, c.Descripcion, c.Tipo, c.Valor, c.CompraMinimaUsd, c.ValidoDesde, c.ValidoHasta,
            c.UsosMaximos, c.UsosActuales, c.Activo,
            // Con subtotal "infinito" la compra mínima no influye: solo se mira el estado del cupón.
            c.MotivoNoAplicable(decimal.MaxValue, DateTime.UtcNow) is null,
            c.CreatedAt, c.ActualizadoEn);
    }
}
