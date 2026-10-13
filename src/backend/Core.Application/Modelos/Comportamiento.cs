using Core.Domain.Enums;

namespace Core.Application.Modelos
{
    // ---- Filas que trae IAnaliticaRepository ----

    // Cuántos eventos de un tipo hubo y en cuántas sesiones distintas.
    public record ConteoEvento(TipoEventoAnalitica Tipo, int Eventos, int Sesiones);

    // Resultados: los que dio la búsqueda la última vez que se hizo en el período.
    public record BusquedaFrecuente(string Texto, int Veces, int Sesiones, int Resultados);

    // Unidades agregadas al carrito frente a unidades vendidas en el mismo período.
    public record ProductoAgregado(Guid ProductoId, string Producto, int UnidadesAgregadas, int Sesiones, int UnidadesVendidas);

    public record CategoriaVisitada(Guid CategoriaId, string Categoria, int Clics, int Sesiones);

    public record UsoCupon(string Codigo, int Aplicados, int Rechazados);

    // Día local de la tienda.
    public record ActividadDia(DateOnly Dia, int Visitas, int Busquedas, int Pedidos);

    // ---- Resultado de AnaliticaService.CalcularAsync (GET /analitica/comportamiento) ----

    // Porcentaje respecto del primer paso (visitas).
    public record PasoEmbudo(string Paso, int Sesiones, decimal Porcentaje);

    public record Comportamiento(
        DateOnly Desde,
        DateOnly Hasta,
        string ZonaHoraria,
        int Visitas,
        int Busquedas,
        int BusquedasSinResultados,
        // % de las búsquedas que no encontraron nada.
        decimal PorcentajeSinResultados,
        // % de las visitas que terminaron en un pedido confirmado.
        decimal TasaConversion,
        IReadOnlyList<PasoEmbudo> Embudo,
        IReadOnlyList<BusquedaFrecuente> MasBuscado,
        IReadOnlyList<BusquedaFrecuente> SinResultados,
        IReadOnlyList<ProductoAgregado> Productos,
        IReadOnlyList<CategoriaVisitada> Categorias,
        IReadOnlyList<UsoCupon> Cupones,
        IReadOnlyList<ActividadDia> PorDia);
}
