using Core.Application.Abstracciones;
using Core.Application.Servicios;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.Servicios
{
    // PedidosService con ofertas de producto y cupones: cotización del checkout, creación del
    // pedido (precios y descuento congelados, uso del cupón dentro de la transacción) y
    // devolución del uso al rechazar. Repositorios simulados con Moq; InventarioService es real.
    public class PedidosServiceDescuentosTests
    {
        private const decimal Tasa = 40m;
        private static readonly Guid ClienteId = Guid.NewGuid();
        private static readonly Guid ZonaId = Guid.NewGuid();

        private readonly Mock<IPedidoRepository> _pedidos = new();
        private readonly Mock<IProductoRepository> _productos = new();
        private readonly Mock<IUsuarioRepository> _usuarios = new();
        private readonly Mock<IZonaRepository> _zonas = new();
        private readonly Mock<IConfiguracionRepository> _configuracion = new();
        private readonly Mock<INotificacionRepository> _notificaciones = new();
        private readonly Mock<ICuponRepository> _cupones = new();
        private readonly Mock<IUnitOfWork> _unidad = new();
        private readonly Mock<ITransaccion> _transaccion = new();
        private readonly Mock<IInventarioRepository> _inventario = new();
        private readonly Mock<IAlmacenamientoArchivos> _archivos = new();

        private readonly Producto _arroz = Producto("Arroz", 2.00m, descuento: 25m); // 1.50 en oferta
        private readonly Producto _cafe = Producto("Café", 5.00m);
        private readonly Cupon _cupon = new()
        {
            Id = Guid.NewGuid(), Codigo = "VERANO10", Tipo = TipoCupon.Porcentaje, Valor = 10m, Activo = true,
        };

        private Pedido? _agregado;
        private readonly PedidosService _servicio;

        public PedidosServiceDescuentosTests()
        {
            _configuracion.Setup(c => c.ObtenerAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Configuracion { TasaBsUsd = Tasa });
            _zonas.Setup(z => z.ExisteActivaAsync(ZonaId, It.IsAny<CancellationToken>())).ReturnsAsync(true);
            _productos.Setup(p => p.ObtenerActivosAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((IReadOnlyCollection<Guid> ids, CancellationToken _) =>
                    new[] { _arroz, _cafe }.Where(p => ids.Contains(p.Id)).ToDictionary(p => p.Id));
            _cupones.Setup(c => c.ObtenerPorCodigoAsync("VERANO10", It.IsAny<CancellationToken>())).ReturnsAsync(_cupon);
            _cupones.Setup(c => c.ConsumirUsoAsync(_cupon.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            _unidad.Setup(u => u.IniciarTransaccionAsync(It.IsAny<CancellationToken>())).ReturnsAsync(_transaccion.Object);
            _unidad.SetupGet(u => u.EnTransaccion).Returns(true);
            _inventario.Setup(i => i.ReservarAsync(It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(10);
            _inventario.Setup(i => i.LiberarAsync(It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(10);
            _archivos.Setup(a => a.GuardarAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("/uploads/capturas/pago.png");
            _pedidos.Setup(p => p.Agregar(It.IsAny<Pedido>())).Callback<Pedido>(p => _agregado = p);

            var inventario = new InventarioService(_inventario.Object, _notificaciones.Object, _unidad.Object);
            _servicio = new PedidosService(_pedidos.Object, _productos.Object, _usuarios.Object, _zonas.Object,
                _configuracion.Object, _notificaciones.Object, _cupones.Object, _unidad.Object, inventario,
                new ColaWhatsapp(), _archivos.Object, NullLogger<PedidosService>.Instance);
        }

        // ---------- CotizarAsync ----------

        [Fact]
        public async Task Cotizar_SinCupon_UsaElPrecioDeOferta()
        {
            var resultado = await _servicio.CotizarAsync(ClienteId, Items((_arroz, 2), (_cafe, 1)), null);

            var c = Assert.IsType<Cotizacion>(resultado.Cotizacion);
            Assert.Equal(1.50m, c.Lineas.Single(l => l.Producto == _arroz).PrecioUsd);
            Assert.Equal(2.00m, c.Lineas.Single(l => l.Producto == _arroz).PrecioListaUsd);
            Assert.Equal(8.00m, c.SubtotalUsd); // 1.50 × 2 + 5.00
            Assert.Equal(0m, c.DescuentoUsd);
            Assert.Equal(8.00m, c.TotalUsd);
            Assert.Equal(320m, c.TotalBs);
        }

        [Fact]
        public async Task Cotizar_ConCupon_DescuentaSobreElSubtotalConOfertas()
        {
            var resultado = await _servicio.CotizarAsync(ClienteId, Items((_arroz, 2), (_cafe, 1)), "  verano10 ");

            var c = Assert.IsType<Cotizacion>(resultado.Cotizacion);
            Assert.Same(_cupon, c.Cupon);
            Assert.Equal(0.80m, c.DescuentoUsd);
            Assert.Equal(7.20m, c.TotalUsd);
            Assert.Equal(32m, c.DescuentoBs);
            Assert.Equal(288m, c.TotalBs);
        }

        [Fact]
        public async Task Cotizar_CuponInexistente_FallaConValidacion()
        {
            var resultado = await _servicio.CotizarAsync(ClienteId, Items((_cafe, 1)), "NOEXISTE");

            Assert.Null(resultado.Cotizacion);
            Assert.Equal(ErrorPedido.Validacion, resultado.Error);
            Assert.Equal("El cupón no existe.", resultado.Mensaje);
        }

        [Fact]
        public async Task Cotizar_CuponYaUsadoPorElCliente_Falla()
        {
            _cupones.Setup(c => c.ClienteLoUsoAsync(_cupon.Id, ClienteId, It.IsAny<CancellationToken>())).ReturnsAsync(true);

            var resultado = await _servicio.CotizarAsync(ClienteId, Items((_cafe, 1)), "VERANO10");

            Assert.Equal(ErrorPedido.Validacion, resultado.Error);
            Assert.Equal("Ya usaste este cupón en otro pedido.", resultado.Mensaje);
        }

        [Fact]
        public async Task Cotizar_DebajoDeLaCompraMinima_Falla()
        {
            _cupon.CompraMinimaUsd = 10m;

            var resultado = await _servicio.CotizarAsync(ClienteId, Items((_cafe, 1)), "VERANO10");

            Assert.Equal(ErrorPedido.Validacion, resultado.Error);
            Assert.Contains("compra mínima", resultado.Mensaje);
        }

        // ---------- CrearAsync ----------

        [Fact]
        public async Task Crear_ConCupon_CongelaPreciosYDescuentoYConsumeElUso()
        {
            var resultado = await _servicio.CrearAsync(ClienteId, NuevoPedido("VERANO10", (_arroz, 2), (_cafe, 1)), Captura());

            Assert.Null(resultado.Error);
            Assert.NotNull(_agregado);
            Assert.Equal(_cupon.Id, _agregado.CuponId);
            Assert.Equal(0.80m, _agregado.DescuentoUsd);
            Assert.Equal(32m, _agregado.DescuentoBs);
            Assert.Equal(7.20m, _agregado.TotalUsd);
            Assert.Equal(288m, _agregado.TotalBs);

            var arroz = _agregado.Items.Single(i => i.ProductoId == _arroz.Id);
            Assert.Equal(1.50m, arroz.PrecioUsd);
            Assert.Equal(60m, arroz.PrecioBs);
            Assert.Equal(2.00m, arroz.PrecioListaUsd);

            _cupones.Verify(c => c.ConsumirUsoAsync(_cupon.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
            _transaccion.Verify(t => t.ConfirmarAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Crear_CuponAgotadoAlConfirmar_RevierteYBorraLaCaptura()
        {
            _cupones.Setup(c => c.ConsumirUsoAsync(_cupon.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            var resultado = await _servicio.CrearAsync(ClienteId, NuevoPedido("VERANO10", (_cafe, 1)), Captura());

            Assert.Equal(ErrorPedido.CuponNoDisponible, resultado.Error);
            _transaccion.Verify(t => t.RevertirAsync(It.IsAny<CancellationToken>()), Times.Once);
            _transaccion.Verify(t => t.ConfirmarAsync(It.IsAny<CancellationToken>()), Times.Never);
            _archivos.Verify(a => a.EliminarAsync("/uploads/capturas/pago.png"), Times.Once);
        }

        [Fact]
        public async Task Crear_ClienteUsoElCuponEnUnPedidoSimultaneo_Revierte()
        {
            // La cotización inicial no lo ve; la consulta dentro de la transacción (tras el bloqueo), sí.
            _cupones.SetupSequence(c => c.ClienteLoUsoAsync(_cupon.Id, ClienteId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false)
                .ReturnsAsync(true);

            var resultado = await _servicio.CrearAsync(ClienteId, NuevoPedido("VERANO10", (_cafe, 1)), Captura());

            Assert.Equal(ErrorPedido.CuponNoDisponible, resultado.Error);
            Assert.Equal("Ya usaste este cupón en otro pedido.", resultado.Mensaje);
            _transaccion.Verify(t => t.ConfirmarAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Crear_SinCupon_NoTocaCupones()
        {
            var resultado = await _servicio.CrearAsync(ClienteId, NuevoPedido(null, (_cafe, 2)), Captura());

            Assert.Null(resultado.Error);
            Assert.Null(_agregado!.CuponId);
            Assert.Equal(0m, _agregado.DescuentoUsd);
            Assert.Equal(10m, _agregado.TotalUsd);
            _cupones.Verify(c => c.ConsumirUsoAsync(It.IsAny<Guid>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // ---------- Rechazo ----------

        [Fact]
        public async Task Rechazar_PedidoConCupon_DevuelveElUso()
        {
            var pedido = PedidoPendiente(_cupon.Id);
            _pedidos.Setup(p => p.BloquearParaActualizarAsync(pedido.Id, It.IsAny<CancellationToken>())).ReturnsAsync(pedido);

            var resultado = await _servicio.RechazarAsync(pedido.Id, null, Guid.NewGuid());

            Assert.Null(resultado.Error);
            _cupones.Verify(c => c.LiberarUsoAsync(_cupon.Id, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Rechazar_PedidoSinCupon_NoTocaCupones()
        {
            var pedido = PedidoPendiente(null);
            _pedidos.Setup(p => p.BloquearParaActualizarAsync(pedido.Id, It.IsAny<CancellationToken>())).ReturnsAsync(pedido);

            await _servicio.RechazarAsync(pedido.Id, null, Guid.NewGuid());

            _cupones.Verify(c => c.LiberarUsoAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // ---------- Datos ----------

        private static Producto Producto(string nombre, decimal precio, decimal? descuento = null) => new()
        {
            Id = Guid.NewGuid(),
            CodigoSku = nombre.ToUpperInvariant(),
            Nombre = nombre,
            PrecioUsd = precio,
            CategoriaId = Guid.NewGuid(),
            StockDisponible = 50,
            DescuentoPorcentaje = descuento,
        };

        private static List<ItemNuevoPedido> Items(params (Producto Producto, int Cantidad)[] lineas) =>
            lineas.Select(l => new ItemNuevoPedido(l.Producto.Id, l.Cantidad)).ToList();

        private static NuevoPedido NuevoPedido(string? cupon, params (Producto Producto, int Cantidad)[] lineas) =>
            new(Items(lineas), MetodoPago.PagoMovil, "123456", ZonaId, "Calle 1, casa azul", null, null,
                "+584141234567", cupon);

        private static ArchivoSubido Captura() => new(new MemoryStream([1, 2, 3]), "pago.png");

        private Pedido PedidoPendiente(Guid? cuponId)
        {
            var pedido = new Pedido
            {
                Id = Guid.NewGuid(),
                ClienteId = ClienteId,
                Cliente = new Usuario { Nombre = "Ana", Email = "ana@correo.com" },
                Zona = new Zona { Nombre = "Centro" },
                DireccionTexto = "Calle 1",
                TelefonoContacto = "+584141234567",
                CuponId = cuponId,
                ExpiraEn = DateTime.UtcNow.AddHours(1),
            };
            pedido.Items.Add(new PedidoItem { ProductoId = _cafe.Id, Cantidad = 1, PrecioUsd = 5m, PrecioListaUsd = 5m });
            return pedido;
        }
    }
}
