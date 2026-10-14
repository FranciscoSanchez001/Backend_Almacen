using System.Text.RegularExpressions;
using Core.Application.Abstracciones;
using Core.Application.Dtos;
using Core.Application.Modelos;
using Core.Domain.Entidades;
using Core.Domain.Enums;

namespace Core.Application.Servicios
{
    // Analítica de comportamiento en la tienda: registra lo que hacen los visitantes y arma el
    // resumen del panel (/admin/comportamiento). Los eventos del personal no se registran: el
    // controlador los descarta antes de llegar aquí.
    public partial class AnaliticaService(
        IAnaliticaRepository analitica,
        IUnitOfWork unidad,
        ReportesOptions opciones)
    {
        public const int LimiteListas = 15;

        // ---- Registro ----

        public async Task RegistrarAsync(string sesionId, Guid? clienteId, IReadOnlyList<EventoRequest> eventos,
            CancellationToken ct = default)
        {
            var ahora = DateTime.UtcNow;
            analitica.Agregar(eventos.Select(e => Crear(e, sesionId, clienteId, ahora)));
            await unidad.GuardarCambiosAsync(ct);
        }

        // La llama /catalogo al responder una búsqueda, con los resultados reales.
        public async Task RegistrarBusquedaAsync(string sesionId, Guid? clienteId, string texto, int resultados,
            CancellationToken ct = default)
        {
            var normalizado = NormalizarBusqueda(texto);
            if (normalizado.Length == 0)
            {
                return;
            }
            analitica.Agregar([new EventoAnalitica
            {
                Tipo = TipoEventoAnalitica.Busqueda,
                SesionId = sesionId,
                ClienteId = clienteId,
                Texto = normalizado,
                Cantidad = resultados,
            }]);
            await unidad.GuardarCambiosAsync(ct);
        }

        // "  Harina   PAN " → "harina pan": así "Harina" y "harina " cuentan como la misma búsqueda.
        public static string NormalizarBusqueda(string texto)
        {
            var limpio = Espacios().Replace(texto.Trim().ToLowerInvariant(), " ");
            return limpio.Length > 200 ? limpio[..200] : limpio;
        }

        // Cada tipo guarda solo los campos que le corresponden.
        private static EventoAnalitica Crear(EventoRequest e, string sesionId, Guid? clienteId, DateTime ahora)
        {
            var evento = new EventoAnalitica { Tipo = e.Tipo, SesionId = sesionId, ClienteId = clienteId, CreatedAt = ahora };
            switch (e.Tipo)
            {
                case TipoEventoAnalitica.PaginaVista:
                    evento.Ruta = e.Ruta?.Trim();
                    break;
                case TipoEventoAnalitica.FiltroCategoria:
                    evento.CategoriaId = e.CategoriaId;
                    break;
                case TipoEventoAnalitica.AgregarCarrito or TipoEventoAnalitica.QuitarCarrito:
                    evento.ProductoId = e.ProductoId;
                    evento.Cantidad = e.Cantidad ?? 1;
                    break;
                case TipoEventoAnalitica.CuponAplicado or TipoEventoAnalitica.CuponRechazado:
                    evento.Texto = string.IsNullOrWhiteSpace(e.Texto) ? null : Cupon.NormalizarCodigo(e.Texto);
                    break;
                case TipoEventoAnalitica.PedidoConfirmado:
                    evento.Valor = e.Valor;
                    break;
            }
            return evento;
        }

        // ---- Resumen del panel ----

        public async Task<Comportamiento> CalcularAsync(Periodo periodo, CancellationToken ct = default)
        {
            var (desde, hasta) = (periodo.DesdeUtc, periodo.HastaUtc);

            var visitas = await analitica.ContarSesionesAsync(desde, hasta, ct);
            var porTipo = (await analitica.ContarPorTipoAsync(desde, hasta, ct)).ToDictionary(c => c.Tipo);
            var masBuscado = await analitica.ListarBusquedasAsync(desde, hasta, false, LimiteListas, ct);
            var sinResultados = await analitica.ListarBusquedasAsync(desde, hasta, true, LimiteListas, ct);
            var productos = await analitica.ListarProductosAgregadosAsync(desde, hasta, LimiteListas, ct);
            var categorias = await analitica.ListarCategoriasAsync(desde, hasta, LimiteListas, ct);
            var cupones = await analitica.ListarCuponesAsync(desde, hasta, ct);
            var actividad = (await analitica.ActividadPorDiaAsync(desde, hasta, opciones.ZonaHoraria, ct))
                .ToDictionary(a => a.Dia);

            int Eventos(TipoEventoAnalitica t) => porTipo.GetValueOrDefault(t)?.Eventos ?? 0;
            int Sesiones(TipoEventoAnalitica t) => porTipo.GetValueOrDefault(t)?.Sesiones ?? 0;

            var busquedas = Eventos(TipoEventoAnalitica.Busqueda);
            var busquedasSinResultados = sinResultados.Sum(b => b.Veces);
            var confirmadas = Sesiones(TipoEventoAnalitica.PedidoConfirmado);

            var embudo = new List<PasoEmbudo>
            {
                Paso("Visitaron la tienda", visitas, visitas),
                Paso("Agregaron al carrito", Sesiones(TipoEventoAnalitica.AgregarCarrito), visitas),
                Paso("Iniciaron el pago", Sesiones(TipoEventoAnalitica.InicioCheckout), visitas),
                Paso("Confirmaron el pedido", confirmadas, visitas),
            };

            // Todos los días del período, también los que no tuvieron actividad, sin pasar de hoy.
            var hoy = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,
                TimeZoneInfo.FindSystemTimeZoneById(opciones.ZonaHoraria)));
            var ultimo = periodo.Hasta < hoy ? periodo.Hasta : hoy;
            var dias = Enumerable.Range(0, Math.Max(0, ultimo.DayNumber - periodo.Desde.DayNumber + 1))
                .Select(periodo.Desde.AddDays)
                .Select(d => actividad.GetValueOrDefault(d) ?? new ActividadDia(d, 0, 0, 0))
                .ToList();

            return new Comportamiento(
                periodo.Desde, periodo.Hasta, opciones.ZonaHoraria,
                visitas, busquedas, busquedasSinResultados,
                Porcentaje(busquedasSinResultados, busquedas),
                Porcentaje(confirmadas, visitas),
                embudo, masBuscado, sinResultados, productos, categorias, cupones, dias);
        }

        private static PasoEmbudo Paso(string nombre, int sesiones, int visitas) => new(nombre, sesiones, Porcentaje(sesiones, visitas));

        private static decimal Porcentaje(int parte, int total) =>
            total == 0 ? 0 : Math.Round(100m * parte / total, 1, MidpointRounding.AwayFromZero);

        [GeneratedRegex(@"\s+")]
        private static partial Regex Espacios();
    }
}
