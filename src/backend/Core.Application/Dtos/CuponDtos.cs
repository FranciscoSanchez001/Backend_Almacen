using Core.Domain.Entidades;
using Core.Domain.Enums;

namespace Core.Application.Dtos
{
    // Las reglas están en Validadores/CuponValidadores.cs.

    // Campos comunes a la creación y la edición.
    public interface IDatosCupon
    {
        string? Descripcion { get; }
        TipoCupon Tipo { get; }
        decimal Valor { get; }
        decimal? CompraMinimaUsd { get; }
        DateTime? ValidoDesde { get; }
        DateTime? ValidoHasta { get; }
        int? UsosMaximos { get; }
        bool Activo { get; }
    }

    public record CrearCuponRequest(
        string Codigo,
        string? Descripcion,
        TipoCupon Tipo,
        decimal Valor,
        decimal? CompraMinimaUsd = null,
        DateTime? ValidoDesde = null,
        DateTime? ValidoHasta = null,
        int? UsosMaximos = null,
        bool Activo = true) : IDatosCupon;

    // El código no se puede cambiar: los clientes ya pueden tenerlo y los pedidos lo referencian.
    public record ActualizarCuponRequest(
        string? Descripcion,
        TipoCupon Tipo,
        decimal Valor,
        decimal? CompraMinimaUsd,
        DateTime? ValidoDesde,
        DateTime? ValidoHasta,
        int? UsosMaximos,
        bool Activo) : IDatosCupon;

    // Checkout: el cliente consulta cuánto pagará (con ofertas y, si escribió uno, el cupón)
    // antes de confirmar. Los precios salen siempre de la base, nunca del navegador.
    public record CotizarPedidoRequest(List<ItemPedidoRequest> Items, string? CodigoCupon);

    // Lo que se guarda en auditoria.datos_antes / datos_despues.
    public record CuponAuditoria(
        string Codigo,
        string? Descripcion,
        TipoCupon Tipo,
        decimal Valor,
        decimal? CompraMinimaUsd,
        DateTime? ValidoDesde,
        DateTime? ValidoHasta,
        int? UsosMaximos,
        bool Activo)
    {
        public static CuponAuditoria De(Cupon c) =>
            new(c.Codigo, c.Descripcion, c.Tipo, c.Valor, c.CompraMinimaUsd, c.ValidoDesde, c.ValidoHasta,
                c.UsosMaximos, c.Activo);
    }
}
