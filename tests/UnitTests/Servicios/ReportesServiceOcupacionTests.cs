using Core.Application.Abstracciones;
using Core.Application.Modelos;
using Core.Application.Servicios;
using Core.Domain.Reglas;
using Moq;

namespace UnitTests.Servicios
{
    // KPI de ocupación del almacén en ReportesService con IReportesRepository simulado: por
    // producto, por categoría y global, contando el stock reservado como ocupado.
    public class ReportesServiceOcupacionTests
    {
        private readonly Mock<IReportesRepository> _repo = new();
        private readonly ReportesService _servicio;
        private readonly Periodo _periodo;

        public ReportesServiceOcupacionTests()
        {
            // Sin pedidos ni movimientos: solo importa el stock actual de los productos.
            _repo.Setup(r => r.ListarPedidosAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);
            _repo.Setup(r => r.ListarItemsVendidosAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);
            _repo.Setup(r => r.StockDisponibleEnAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);

            _servicio = new ReportesService(_repo.Object, new ReportesOptions { ZonaHoraria = "America/Caracas" });
            _periodo = _servicio.ResolverPeriodo(TipoReporte.Mensual, new DateOnly(2026, 9, 1), null).Periodo!;
        }

        [Fact]
        public async Task CalcularKpis_OcupacionPorProducto_SumaElStockReservado()
        {
            // Arrange
            var arroz = Producto("Arroz", "Víveres", disponible: 40, reservado: 10, maximo: 100);
            ConProductos(arroz);

            // Act
            var kpis = await _servicio.CalcularKpisAsync(_periodo);

            // Assert
            var fila = Assert.Single(kpis.Inventario.Productos);
            Assert.Equal(100, fila.StockMaximo);
            Assert.Equal(50m, fila.Ocupacion);
            Assert.Equal(NivelOcupacion.Optima, fila.NivelOcupacion);
            _repo.Verify(r => r.ListarProductosActivosAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task CalcularKpis_OcupacionGlobalYPorCategoria_PonderaPorCapacidad()
        {
            // Arrange: la global no es el promedio de porcentajes (50 % y 100 %), sino
            // unidades totales ÷ capacidad total: (25 + 150) ÷ (50 + 150) = 87,5 %.
            ConProductos(
                Producto("Arroz", "Víveres", disponible: 25, reservado: 0, maximo: 50),
                Producto("Agua", "Bebidas", disponible: 140, reservado: 10, maximo: 150));

            // Act
            var inventario = (await _servicio.CalcularKpisAsync(_periodo)).Inventario;

            // Assert
            Assert.Equal(87.5m, inventario.OcupacionGlobal);
            Assert.Equal(NivelOcupacion.Alta, inventario.NivelOcupacionGlobal);
            Assert.Collection(inventario.OcupacionPorCategoria, // de mayor a menor ocupación
                bebidas =>
                {
                    Assert.Equal("Bebidas", bebidas.Categoria);
                    Assert.Equal(100m, bebidas.Ocupacion);
                    Assert.Equal(NivelOcupacion.Alta, bebidas.NivelOcupacion);
                },
                viveres =>
                {
                    Assert.Equal("Víveres", viveres.Categoria);
                    Assert.Equal(50m, viveres.Ocupacion);
                });
        }

        [Fact]
        public async Task CalcularKpis_StockSobreLaCapacidad_CuentaComoSaturado()
        {
            // Arrange
            ConProductos(
                Producto("Cloro", "Limpieza", disponible: 120, reservado: 5, maximo: 100),
                Producto("Jabón", "Limpieza", disponible: 10, reservado: 0, maximo: 100));

            // Act
            var inventario = (await _servicio.CalcularKpisAsync(_periodo)).Inventario;

            // Assert
            Assert.Equal(1, inventario.ProductosSaturados);
            var cloro = inventario.Productos.Single(p => p.Producto == "Cloro");
            Assert.Equal(125m, cloro.Ocupacion);
            Assert.Equal(NivelOcupacion.Saturada, cloro.NivelOcupacion);
        }

        [Fact]
        public async Task CalcularKpis_SinProductos_OcupacionGlobalEsNull()
        {
            // Arrange
            ConProductos();

            // Act
            var inventario = (await _servicio.CalcularKpisAsync(_periodo)).Inventario;

            // Assert
            Assert.Null(inventario.OcupacionGlobal);
            Assert.Null(inventario.NivelOcupacionGlobal);
            Assert.Empty(inventario.OcupacionPorCategoria);
        }

        private void ConProductos(params ProductoStock[] productos) =>
            _repo.Setup(r => r.ListarProductosActivosAsync(It.IsAny<CancellationToken>())).ReturnsAsync([.. productos]);

        private static ProductoStock Producto(string nombre, string categoria, int disponible, int reservado, int maximo) =>
            new(Guid.NewGuid(), nombre, categoria, disponible, reservado, maximo);
    }
}
