using Core.Domain.Enums;

namespace Core.Application.Dtos
{
    // POST /analitica/eventos. El navegador junta los eventos y los manda por lotes. Las reglas
    // están en Validadores/AnaliticaValidadores.cs.
    public record RegistrarEventosRequest(string SesionId, List<EventoRequest> Eventos);

    // Solo se usan los campos que corresponden al tipo; los demás se descartan.
    public record EventoRequest(
        TipoEventoAnalitica Tipo,
        string? Ruta = null,
        Guid? ProductoId = null,
        Guid? CategoriaId = null,
        string? Texto = null,
        int? Cantidad = null,
        decimal? Valor = null);
}
