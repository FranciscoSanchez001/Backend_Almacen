using Core.Application.Abstracciones;
using Core.Application.Dtos;
using Core.Application.Modelos;
using Core.Application.Servicios;
using Core.Application.Validadores;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Moq;

namespace UnitTests.Servicios
{
    // AnaliticaService con IAnaliticaRepository simulado: qué se guarda de cada evento y cómo se
    // arma el resumen del panel (embudo, porcentajes y días sin actividad).
    public class AnaliticaServiceTests
    {
        private const string Sesion = "sesion-0001";
        private static readonly ReportesOptions Opciones = new() { ZonaHoraria = "America/Caracas" };

        private readonly Mock<IAnaliticaRepository> _repo = new();
        private readonly Mock<IUnitOfWork> _unidad = new();
        private readonly List<EventoAnalitica> _guardados = [];
        private readonly AnaliticaService _servicio;

        public AnaliticaServiceTests()
        {
            _repo.Setup(r => r.Agregar(It.IsAny<IEnumerable<EventoAnalitica>>()))
                .Callback<IEnumerable<EventoAnalitica>>(e => _guardados.AddRange(e));

            // Sin datos por defecto; cada prueba configura lo que necesita.
            _repo.Setup(r => r.ContarPorTipoAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);
            _repo.Setup(r => r.ListarBusquedasAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<bool>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);
            _repo.Setup(r => r.ListarProductosAgregadosAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);
            _repo.Setup(r => r.ListarCategoriasAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);
            _repo.Setup(r => r.ListarCuponesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);
            _repo.Setup(r => r.ActividadPorDiaAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);

            _servicio = new AnaliticaService(_repo.Object, _unidad.Object, Opciones);
        }

        // ---------- Registro ----------

        [Fact]
        public async Task Registrar_GuardaSoloLosCamposDeCadaTipo()
        {
            var producto = Guid.NewGuid();
            var categoria = Guid.NewGuid();
            var clienteId = Guid.NewGuid();

            await _servicio.RegistrarAsync(Sesion, clienteId,
            [
                new EventoRequest(TipoEventoAnalitica.PaginaVista, Ruta: " /checkout ", ProductoId: producto),
                new EventoRequest(TipoEventoAnalitica.FiltroCategoria, CategoriaId: categoria, Texto: "ignorado"),
                new EventoRequest(TipoEventoAnalitica.AgregarCarrito, ProductoId: producto),
                new EventoRequest(TipoEventoAnalitica.CuponRechazado, Texto: "  verano10 "),
                new EventoRequest(TipoEventoAnalitica.PedidoConfirmado, Valor: 7.2m, Cantidad: 3),
            ]);

            Assert.All(_guardados, e => Assert.Equal(Sesion, e.SesionId));
            Assert.All(_guardados, e => Assert.Equal(clienteId, e.ClienteId));
            Assert.Collection(_guardados,
                e => { Assert.Equal("/checkout", e.Ruta); Assert.Null(e.ProductoId); },
                e => { Assert.Equal(categoria, e.CategoriaId); Assert.Null(e.Texto); },
                e => { Assert.Equal(producto, e.ProductoId); Assert.Equal(1, e.Cantidad); },
                e => Assert.Equal("VERANO10", e.Texto),
                e => { Assert.Equal(7.2m, e.Valor); Assert.Null(e.Cantidad); });
            _unidad.Verify(u => u.GuardarCambiosAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task RegistrarBusqueda_NormalizaElTextoYGuardaLosResultados()
        {
            await _servicio.RegistrarBusquedaAsync(Sesion, null, "  Harina   PAN ", 0);

            var evento = Assert.Single(_guardados);
            Assert.Equal(TipoEventoAnalitica.Busqueda, evento.Tipo);
            Assert.Equal("harina pan", evento.Texto);
            Assert.Equal(0, evento.Cantidad);
            Assert.Null(evento.ClienteId);
        }

        [Fact]
        public async Task RegistrarBusqueda_SoloEspacios_NoGuardaNada()
        {
            await _servicio.RegistrarBusquedaAsync(Sesion, null, "   ", 5);

            Assert.Empty(_guardados);
            _unidad.Verify(u => u.GuardarCambiosAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public void Validador_RechazaBusquedasDesdeElNavegadorYLotesGrandes()
        {
            var validador = new RegistrarEventosValidator();

            Assert.False(validador.Validate(new RegistrarEventosRequest(Sesion,
                [new EventoRequest(TipoEventoAnalitica.Busqueda, Texto: "arroz")])).IsValid);
            Assert.False(validador.Validate(new RegistrarEventosRequest(Sesion,
                Enumerable.Repeat(new EventoRequest(TipoEventoAnalitica.AbrirCarrito), 51).ToList())).IsValid);
            Assert.False(validador.Validate(new RegistrarEventosRequest("corta",
                [new EventoRequest(TipoEventoAnalitica.AbrirCarrito)])).IsValid);
            Assert.True(validador.Validate(new RegistrarEventosRequest(Sesion,
                [new EventoRequest(TipoEventoAnalitica.AgregarCarrito, ProductoId: Guid.NewGuid(), Cantidad: 2)])).IsValid);
        }

        // ---------- Resumen ----------

        [Fact]
        public async Task Calcular_ArmaElEmbudoYLosPorcentajes()
        {
            var periodo = Periodo(new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 3));
            _repo.Setup(r => r.ContarSesionesAsync(periodo.DesdeUtc, periodo.HastaUtc, It.IsAny<CancellationToken>()))
                .ReturnsAsync(200);
            _repo.Setup(r => r.ContarPorTipoAsync(periodo.DesdeUtc, periodo.HastaUtc, It.IsAny<CancellationToken>()))
                .ReturnsAsync([
                    new ConteoEvento(TipoEventoAnalitica.Busqueda, 80, 50),
                    new ConteoEvento(TipoEventoAnalitica.AgregarCarrito, 150, 60),
                    new ConteoEvento(TipoEventoAnalitica.InicioCheckout, 30, 25),
                    new ConteoEvento(TipoEventoAnalitica.PedidoConfirmado, 9, 9),
                ]);
            _repo.Setup(r => r.ListarBusquedasAsync(periodo.DesdeUtc, periodo.HastaUtc, true, It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([new BusquedaFrecuente("pañales", 6, 4, 0), new BusquedaFrecuente("yuca", 4, 3, 0)]);
            _repo.Setup(r => r.ActividadPorDiaAsync(periodo.DesdeUtc, periodo.HastaUtc, "America/Caracas", It.IsAny<CancellationToken>()))
                .ReturnsAsync([new ActividadDia(new DateOnly(2026, 9, 2), 120, 50, 5)]);

            var r = await _servicio.CalcularAsync(periodo);

            Assert.Equal(200, r.Visitas);
            Assert.Equal(80, r.Busquedas);
            Assert.Equal(10, r.BusquedasSinResultados);
            Assert.Equal(12.5m, r.PorcentajeSinResultados);
            Assert.Equal(4.5m, r.TasaConversion);
            Assert.Equal([200, 60, 25, 9], r.Embudo.Select(p => p.Sesiones));
            Assert.Equal([100m, 30m, 12.5m, 4.5m], r.Embudo.Select(p => p.Porcentaje));

            // Los días sin actividad aparecen en cero.
            Assert.Equal([0, 120, 0], r.PorDia.Select(d => d.Visitas));
            Assert.Equal(new DateOnly(2026, 9, 1), r.PorDia[0].Dia);
        }

        [Fact]
        public async Task Calcular_SinDatos_NoDivideEntreCero()
        {
            var r = await _servicio.CalcularAsync(Periodo(new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 1)));

            Assert.Equal(0, r.Visitas);
            Assert.Equal(0m, r.PorcentajeSinResultados);
            Assert.Equal(0m, r.TasaConversion);
            Assert.All(r.Embudo, p => Assert.Equal(0m, p.Porcentaje));
        }

        [Fact]
        public async Task Calcular_PeriodoQueLlegaAlFuturo_NoMuestraDiasQueNoHanPasado()
        {
            var hoy = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(-4)); // Caracas, UTC−4
            var r = await _servicio.CalcularAsync(Periodo(hoy.AddDays(-2), hoy.AddDays(10)));

            Assert.InRange(r.PorDia.Count, 2, 4); // Tolera el cambio de día entre UTC y Caracas.
            Assert.True(r.PorDia[^1].Dia <= hoy.AddDays(1));
        }

        private static Periodo Periodo(DateOnly desde, DateOnly hasta) =>
            new(TipoReporte.Personalizado, desde, hasta,
                desde.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddHours(4),
                hasta.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddHours(4));
    }
}
