using Backend_Almacen.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Services
{
    public class TasaService(AlmacenDbContext db)
    {
        // Null mientras el superadmin no haya cargado ninguna tasa.
        public Task<decimal?> ObtenerActualAsync() =>
            db.Configuracion.AsNoTracking()
                .Where(c => c.Id == 1)
                .Select(c => c.TasaBsUsd)
                .SingleOrDefaultAsync();

        public static decimal? EnBs(decimal precioUsd, decimal? tasa) =>
            tasa is null ? null : Math.Round(precioUsd * tasa.Value, 2, MidpointRounding.AwayFromZero);
    }
}
