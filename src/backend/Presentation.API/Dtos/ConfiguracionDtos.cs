using Core.Domain.Entidades;

namespace Presentation.API.Dtos
{
    public record ConfiguracionResponse(
        decimal? TasaBsUsd,
        string? NumeroSoporte,
        int HorasExpiracion,
        string? DatosTransferencia,
        string? DatosPagoMovil,
        string? WalletBinance,
        IReadOnlyList<string> NumerosPrueba)
    {
        public static ConfiguracionResponse De(Configuracion c) => new(
            c.TasaBsUsd, c.NumeroSoporte, c.HorasExpiracion, c.DatosTransferencia, c.DatosPagoMovil,
            c.WalletBinance, c.NumerosPrueba);
    }

    public record HistorialTasaResponse(Guid Id, decimal Tasa, Guid UsuarioId, string Usuario, DateTime CreadoEn)
    {
        // Debe traer el usuario cargado.
        public static HistorialTasaResponse De(HistorialTasa h) => new(h.Id, h.Tasa, h.UsuarioId, h.Usuario.Nombre, h.CreatedAt);
    }

    // Lo que se guarda en auditoria.datos_antes / datos_despues.
    public record ConfiguracionAuditoria(
        string? NumeroSoporte,
        int HorasExpiracion,
        string? DatosTransferencia,
        string? DatosPagoMovil,
        string? WalletBinance,
        string NumerosPrueba)
    {
        // NumerosPrueba como texto para que la comparación con == sea por valor.
        public static ConfiguracionAuditoria De(Configuracion c) => new(
            c.NumeroSoporte, c.HorasExpiracion, c.DatosTransferencia, c.DatosPagoMovil, c.WalletBinance,
            string.Join(", ", c.NumerosPrueba));
    }
}
