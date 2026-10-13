namespace Core.Application.Comun
{
    public static class FechasUtc
    {
        // Npgsql exige DateTime UTC para timestamptz. Con zona ("...Z" o "-04:00") la fecha llega
        // en UTC o en hora local del servidor (Kind = Local) y se pasa a UTC; sin zona
        // (Kind = Unspecified) se toma como UTC.
        public static DateTime? AUtc(DateTime? fecha) => fecha switch
        {
            null => null,
            { Kind: DateTimeKind.Utc } f => f,
            { Kind: DateTimeKind.Local } f => f.ToUniversalTime(),
            { } f => DateTime.SpecifyKind(f, DateTimeKind.Utc),
        };
    }
}
