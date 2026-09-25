using Core.Application.Abstracciones;

namespace Core.Application.Servicios
{
    public class TasaService(IConfiguracionRepository configuracion)
    {
        // Null mientras el superadmin no haya cargado ninguna tasa.
        public async Task<decimal?> ObtenerActualAsync(CancellationToken ct = default) =>
            (await configuracion.ObtenerAsync(ct)).TasaBsUsd;

        public static decimal? EnBs(decimal precioUsd, decimal? tasa) =>
            tasa is null ? null : Math.Round(precioUsd * tasa.Value, 2, MidpointRounding.AwayFromZero);
    }
}
