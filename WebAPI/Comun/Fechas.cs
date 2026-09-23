namespace Backend_Almacen.WebAPI.Comun
{
    public static class Fechas
    {
        // Npgsql exige DateTime UTC para timestamptz. Las fechas del query string llegan así:
        // con zona ("...Z" o "-04:00") ASP.NET las convierte a hora local del servidor (Kind =
        // Local), así que hay que volver a UTC; sin zona (Kind = Unspecified) se toman como UTC.
        public static DateTime? AUtc(DateTime? fecha) => fecha switch
        {
            null => null,
            { Kind: DateTimeKind.Utc } f => f,
            { Kind: DateTimeKind.Local } f => f.ToUniversalTime(),
            { } f => DateTime.SpecifyKind(f, DateTimeKind.Utc),
        };
    }
}
