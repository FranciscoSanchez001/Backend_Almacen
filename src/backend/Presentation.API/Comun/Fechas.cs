using Core.Application.Comun;

namespace Presentation.API.Comun
{
    public static class Fechas
    {
        // Npgsql exige DateTime UTC para timestamptz. Las fechas del query string llegan así:
        // con zona ("...Z" o "-04:00") ASP.NET las convierte a hora local del servidor (Kind =
        // Local), así que hay que volver a UTC; sin zona (Kind = Unspecified) se toman como UTC.
        public static DateTime? AUtc(DateTime? fecha) => FechasUtc.AUtc(fecha);
    }
}
