using Core.Application.Abstracciones;
using Core.Application.Dtos;
using Core.Application.Excepciones;
using Core.Application.Servicios;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Moq;

namespace UnitTests.Servicios
{
    // ProductoService con IProductoRepository y el resto de dependencias simuladas con Moq.
    // InventarioService y AuditoriaService son las clases reales: sus repositorios también son
    // simulados, así se verifica el movimiento y la auditoría que deja cada caso de uso.
    public class ProductoServiceTests
    {
        private static readonly Guid UsuarioId = Guid.NewGuid();
        private static readonly Guid CategoriaId = Guid.NewGuid();

        private readonly Mock<IProductoRepository> _productos = new();
        private readonly Mock<ICategoriaRepository> _categorias = new();
        private readonly Mock<IUnitOfWork> _unidad = new();
        private readonly Mock<ITransaccion> _transaccion = new();
        private readonly Mock<IInventarioRepository> _inventario = new();
        private readonly Mock<INotificacionRepository> _notificaciones = new();
        private readonly Mock<IAuditoriaRepository> _auditoria = new();

        private readonly List<MovimientoInventario> _movimientos = [];
        private readonly List<Auditoria> _auditorias = [];
        private readonly List<Notificacion> _avisos = [];

        private readonly ProductoService _servicio;

        public ProductoServiceTests()
        {
            // Escenario feliz por defecto: SKU libre y categoría existente.
            _productos.Setup(p => p.SkuEnUsoAsync(It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
            _categorias.Setup(c => c.ExisteAsync(CategoriaId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // EnTransaccion pasa a true al abrir la transacción, como en la implementación real.
            var enTransaccion = false;
            _unidad.Setup(u => u.IniciarTransaccionAsync(It.IsAny<CancellationToken>()))
                .Callback(() => enTransaccion = true)
                .ReturnsAsync(_transaccion.Object);
            _unidad.SetupGet(u => u.EnTransaccion).Returns(() => enTransaccion);

            _inventario.Setup(i => i.AgregarMovimiento(It.IsAny<MovimientoInventario>()))
                .Callback<MovimientoInventario>(_movimientos.Add);
            _auditoria.Setup(a => a.Agregar(It.IsAny<Auditoria>()))
                .Callback<Auditoria>(_auditorias.Add);
            _notificaciones.Setup(n => n.Agregar(It.IsAny<Notificacion>()))
                .Callback<Notificacion>(_avisos.Add);

            var inventario = new InventarioService(_inventario.Object, _notificaciones.Object, _unidad.Object);
            var auditoria = new AuditoriaService(_auditoria.Object);
            _servicio = new ProductoService(_productos.Object, _categorias.Object, _unidad.Object, inventario, auditoria);
        }

        // ---------- CrearAsync ----------

        [Fact]
        public async Task CrearAsync_DatosValidos_GuardaElProductoNormalizadoDentroDeUnaTransaccion()
        {
            Producto? agregado = null;
            _productos.Setup(p => p.Agregar(It.IsAny<Producto>())).Callback<Producto>(p => agregado = p);
            var req = CrearRequest(sku: "  viv-0001 ", nombre: "  Arroz  ", precio: 1.005m, costo: 0.555m,
                ubicacion: "   ", unidadMedida: " KG ");

            var id = await _servicio.CrearAsync(req, UsuarioId);

            Assert.NotNull(agregado);
            Assert.Equal(id, agregado.Id);
            Assert.NotEqual(Guid.Empty, id);
            Assert.Equal("VIV-0001", agregado.CodigoSku);
            Assert.Equal("Arroz", agregado.Nombre);
            Assert.Equal(1.01m, agregado.PrecioUsd);
            Assert.Equal(0.56m, agregado.CostoUsd);
            Assert.Null(agregado.Ubicacion);
            Assert.Equal("kg", agregado.UnidadMedida);
            Assert.Equal(CategoriaId, agregado.CategoriaId);
            Assert.Equal(UsuarioId, agregado.CreadoPorId);
            Assert.True(agregado.Activo);

            _unidad.Verify(u => u.GuardarCambiosAsync(It.IsAny<CancellationToken>()), Times.Once);
            _transaccion.Verify(t => t.ConfirmarAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task CrearAsync_ConStockInicial_RegistraUnaReposicionDesdeCero()
        {
            var id = await _servicio.CrearAsync(CrearRequest(stockInicial: 25), UsuarioId);

            var movimiento = Assert.Single(_movimientos);
            Assert.Equal(id, movimiento.ProductoId);
            Assert.Equal(TipoMovimientoInventario.Reposicion, movimiento.Tipo);
            Assert.Equal(25, movimiento.Cantidad);
            Assert.Equal(0, movimiento.DisponibleAntes);
            Assert.Equal(25, movimiento.DisponibleDespues);
            Assert.Equal(UsuarioId, movimiento.UsuarioId);
            Assert.Null(movimiento.PedidoId);
        }

        [Fact]
        public async Task CrearAsync_SinStockInicial_NoRegistraMovimientos()
        {
            await _servicio.CrearAsync(CrearRequest(stockInicial: 0), UsuarioId);

            Assert.Empty(_movimientos);
            _unidad.Verify(u => u.GuardarCambiosAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task CrearAsync_RegistraAuditoriaDeCreacionSinDatosAnteriores()
        {
            var id = await _servicio.CrearAsync(CrearRequest(sku: "viv-0002"), UsuarioId);

            var registro = Assert.Single(_auditorias);
            Assert.Equal(Entidades.Producto, registro.Entidad);
            Assert.Equal(id, registro.EntidadId);
            Assert.Equal(AccionAuditoria.Crear, registro.Accion);
            Assert.Equal(UsuarioId, registro.UsuarioId);
            Assert.Null(registro.DatosAntes);
            Assert.Contains("\"codigoSku\":\"VIV-0002\"", registro.DatosDespues);
        }

        [Fact]
        public async Task CrearAsync_SkuEnUso_LanzaConflictoSinGuardarNada()
        {
            _productos.Setup(p => p.SkuEnUsoAsync("VIV-0001", null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var error = await Assert.ThrowsAsync<ConflictoException>(
                () => _servicio.CrearAsync(CrearRequest(sku: "viv-0001"), UsuarioId));

            Assert.Contains("VIV-0001", error.Message);
            _productos.Verify(p => p.Agregar(It.IsAny<Producto>()), Times.Never);
            VerificarQueNoSeGuardo();
        }

        [Fact]
        public async Task CrearAsync_CategoriaInexistente_LanzaInvalidOperationSinGuardarNada()
        {
            var req = CrearRequest() with { CategoriaId = Guid.NewGuid() };

            var error = await Assert.ThrowsAsync<InvalidOperationException>(() => _servicio.CrearAsync(req, UsuarioId));

            Assert.Equal("La categoría no existe.", error.Message);
            _productos.Verify(p => p.Agregar(It.IsAny<Producto>()), Times.Never);
            VerificarQueNoSeGuardo();
        }

        // ---------- ActualizarAsync ----------

        [Fact]
        public async Task ActualizarAsync_ProductoInexistente_LanzaKeyNotFound()
        {
            var id = Guid.NewGuid();
            _productos.Setup(p => p.ObtenerActivoParaEditarAsync(id, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Producto?)null);

            await Assert.ThrowsAsync<KeyNotFoundException>(
                () => _servicio.ActualizarAsync(id, ActualizarRequest(), UsuarioId));

            VerificarQueNoSeGuardo();
        }

        [Fact]
        public async Task ActualizarAsync_SkuDeOtroProducto_LanzaConflictoExcluyendoAlPropioProducto()
        {
            var producto = ProductoExistente();
            _productos.Setup(p => p.SkuEnUsoAsync("VIV-0099", producto.Id, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            await Assert.ThrowsAsync<ConflictoException>(
                () => _servicio.ActualizarAsync(producto.Id, ActualizarRequest(sku: "viv-0099"), UsuarioId));

            Assert.Equal("VIV-0001", producto.CodigoSku);
            VerificarQueNoSeGuardo();
        }

        [Fact]
        public async Task ActualizarAsync_ConCambios_ActualizaGuardaYAuditaElAntesYDespues()
        {
            var producto = ProductoExistente();

            await _servicio.ActualizarAsync(producto.Id, ActualizarRequest(nombre: "Arroz integral", precio: 2.5m), UsuarioId);

            Assert.Equal("Arroz integral", producto.Nombre);
            Assert.Equal(2.5m, producto.PrecioUsd);
            Assert.NotNull(producto.ActualizadoEn);

            var registro = Assert.Single(_auditorias);
            Assert.Equal(AccionAuditoria.Editar, registro.Accion);
            Assert.Equal(producto.Id, registro.EntidadId);
            Assert.Contains("\"nombre\":\"Arroz\"", registro.DatosAntes);
            Assert.Contains("\"nombre\":\"Arroz integral\"", registro.DatosDespues);

            _unidad.Verify(u => u.GuardarCambiosAsync(It.IsAny<CancellationToken>()), Times.Once);
            _transaccion.Verify(t => t.ConfirmarAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ActualizarAsync_SinCambios_NoGuardaNiAudita()
        {
            var producto = ProductoExistente();

            await _servicio.ActualizarAsync(producto.Id, ActualizarRequest(), UsuarioId);

            Assert.Null(producto.ActualizadoEn);
            Assert.Empty(_auditorias);
            VerificarQueNoSeGuardo();
        }

        [Fact]
        public async Task ActualizarAsync_StockIgualAlActual_NoAjustaElInventario()
        {
            var producto = ProductoExistente(stock: 10);

            await _servicio.ActualizarAsync(producto.Id, ActualizarRequest(stock: 10), UsuarioId);

            _inventario.Verify(i => i.AjustarAsync(It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<CancellationToken>()), Times.Never);
            Assert.Empty(_movimientos);
        }

        [Fact]
        public async Task ActualizarAsync_StockDistinto_AjustaElInventarioYRegistraElMovimiento()
        {
            var producto = ProductoExistente(stock: 10);
            _inventario.Setup(i => i.AjustarAsync(producto.Id, 10, 4, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            await _servicio.ActualizarAsync(producto.Id, ActualizarRequest(stock: 4), UsuarioId);

            Assert.Equal(4, producto.StockDisponible);
            var movimiento = Assert.Single(_movimientos);
            Assert.Equal(TipoMovimientoInventario.Ajuste, movimiento.Tipo);
            Assert.Equal(-6, movimiento.Cantidad);
            Assert.Equal(10, movimiento.DisponibleAntes);
            Assert.Equal(4, movimiento.DisponibleDespues);
            Assert.Empty(_avisos);
            _transaccion.Verify(t => t.ConfirmarAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ActualizarAsync_StockACero_AvisaQueElProductoSeAgoto()
        {
            var producto = ProductoExistente(stock: 3);
            _inventario.Setup(i => i.AjustarAsync(producto.Id, 3, 0, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            await _servicio.ActualizarAsync(producto.Id, ActualizarRequest(stock: 0), UsuarioId);

            var aviso = Assert.Single(_avisos);
            Assert.Equal(TipoNotificacion.StockAgotado, aviso.Tipo);
            Assert.Equal(producto.Id, aviso.ProductoId);
        }

        [Fact]
        public async Task ActualizarAsync_StockReponeUnProductoAgotado_ResuelveElAviso()
        {
            var producto = ProductoExistente(stock: 0);
            _inventario.Setup(i => i.AjustarAsync(producto.Id, 0, 15, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            await _servicio.ActualizarAsync(producto.Id, ActualizarRequest(stock: 15), UsuarioId);

            _notificaciones.Verify(n => n.MarcarAgotadoResueltoAsync(producto.Id, It.IsAny<CancellationToken>()), Times.Once);
            Assert.Empty(_avisos);
        }

        [Fact]
        public async Task ActualizarAsync_StockCambioMientrasSeEditaba_LanzaConflictoSinGuardar()
        {
            var producto = ProductoExistente(stock: 10);
            _inventario.Setup(i => i.AjustarAsync(producto.Id, 10, 4, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            await Assert.ThrowsAsync<ConflictoException>(
                () => _servicio.ActualizarAsync(producto.Id, ActualizarRequest(stock: 4), UsuarioId));

            Assert.Equal(10, producto.StockDisponible);
            Assert.Empty(_movimientos);
            Assert.Empty(_auditorias);
            VerificarQueNoSeGuardo();
        }

        // ---------- BorrarAsync ----------

        [Fact]
        public async Task BorrarAsync_ProductoExistente_LoDesactivaYAuditaElBorrado()
        {
            var producto = ProductoExistente();

            await _servicio.BorrarAsync(producto.Id, UsuarioId);

            Assert.False(producto.Activo);
            Assert.NotNull(producto.ActualizadoEn);

            var registro = Assert.Single(_auditorias);
            Assert.Equal(AccionAuditoria.Borrar, registro.Accion);
            Assert.Contains("\"activo\":true", registro.DatosAntes);
            Assert.Contains("\"activo\":false", registro.DatosDespues);
            _unidad.Verify(u => u.GuardarCambiosAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task BorrarAsync_ProductoInexistente_LanzaKeyNotFound()
        {
            var id = Guid.NewGuid();

            await Assert.ThrowsAsync<KeyNotFoundException>(() => _servicio.BorrarAsync(id, UsuarioId));

            Assert.Empty(_auditorias);
            VerificarQueNoSeGuardo();
        }

        // ---------- Ayudas ----------

        // Producto activo que el repositorio devuelve para editar, con los mismos datos que
        // ActualizarRequest() por defecto.
        private Producto ProductoExistente(int stock = 10)
        {
            var producto = new Producto
            {
                Id = Guid.NewGuid(),
                CodigoSku = "VIV-0001",
                Nombre = "Arroz",
                Descripcion = "Arroz blanco de 1 kg",
                PrecioUsd = 1.5m,
                CostoUsd = 1m,
                CategoriaId = CategoriaId,
                StockDisponible = stock,
                StockMinimo = 5,
                StockMaximo = 100,
                Ubicacion = "P1-E1",
                UnidadMedida = "unidad",
            };
            _productos.Setup(p => p.ObtenerActivoParaEditarAsync(producto.Id, It.IsAny<CancellationToken>()))
                .ReturnsAsync(producto);
            return producto;
        }

        private static CrearProductoRequest CrearRequest(string sku = "VIV-0001", string nombre = "Arroz",
            decimal precio = 1.5m, decimal costo = 1m, int stockInicial = 10, string? ubicacion = "P1-E1",
            string unidadMedida = "unidad") =>
            new(sku, nombre, "Arroz blanco de 1 kg", precio, costo, null, CategoriaId, stockInicial,
                5, 100, ubicacion, unidadMedida);

        private static ActualizarProductoRequest ActualizarRequest(string sku = "VIV-0001", string nombre = "Arroz",
            decimal precio = 1.5m, int? stock = null) =>
            new(sku, nombre, "Arroz blanco de 1 kg", precio, 1m, null, CategoriaId, stock,
                5, 100, "P1-E1", "unidad");

        private void VerificarQueNoSeGuardo()
        {
            _unidad.Verify(u => u.GuardarCambiosAsync(It.IsAny<CancellationToken>()), Times.Never);
            _transaccion.Verify(t => t.ConfirmarAsync(It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}
