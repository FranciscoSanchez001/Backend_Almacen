using Core.Domain.Entidades;
using Core.Domain.Enums;

namespace UnitTests.Dominio
{
    // Reglas de las ofertas de producto y de los cupones (Core.Domain), sin dependencias.
    public class DescuentosTests
    {
        private static readonly DateTime Ahora = new(2026, 10, 13, 12, 0, 0, DateTimeKind.Utc);

        // ---------- Ofertas de producto ----------

        [Fact]
        public void PrecioVigente_SinOferta_EsElPrecioDeLista()
        {
            var producto = Producto(10m);

            Assert.False(producto.TieneOfertaVigente(Ahora));
            Assert.Equal(10m, producto.PrecioVigenteUsd(Ahora));
        }

        [Fact]
        public void PrecioVigente_OfertaSinFechas_AplicaElPorcentajeYRedondea()
        {
            var producto = Producto(3.99m, descuento: 15m);

            Assert.True(producto.TieneOfertaVigente(Ahora));
            Assert.Equal(3.39m, producto.PrecioVigenteUsd(Ahora)); // 3.3915
        }

        [Theory]
        [InlineData(-2, -1, false)] // ya terminó
        [InlineData(1, 2, false)]   // todavía no empieza
        [InlineData(-1, 1, true)]   // en curso
        [InlineData(0, 1, true)]    // empieza justo ahora (desde inclusive)
        [InlineData(-1, 0, false)]  // termina justo ahora (hasta exclusive)
        public void PrecioVigente_RespetaLaVigencia(int desdeHoras, int hastaHoras, bool vigente)
        {
            var producto = Producto(10m, descuento: 50m,
                desde: Ahora.AddHours(desdeHoras), hasta: Ahora.AddHours(hastaHoras));

            Assert.Equal(vigente, producto.TieneOfertaVigente(Ahora));
            Assert.Equal(vigente ? 5m : 10m, producto.PrecioVigenteUsd(Ahora));
        }

        // ---------- Cupones ----------

        [Fact]
        public void CalcularDescuento_Porcentaje_RedondeaADosDecimales()
        {
            var cupon = Cupon(TipoCupon.Porcentaje, 10m);

            Assert.Equal(1.23m, cupon.CalcularDescuento(12.34m)); // 1.234
        }

        [Fact]
        public void CalcularDescuento_MontoFijoMayorQueElSubtotal_NoDejaElTotalNegativo()
        {
            var cupon = Cupon(TipoCupon.MontoFijo, 20m);

            Assert.Equal(15m, cupon.CalcularDescuento(15m));
            Assert.Equal(20m, cupon.CalcularDescuento(50m));
        }

        [Fact]
        public void MotivoNoAplicable_CuponValido_DevuelveNull()
        {
            var cupon = Cupon(TipoCupon.Porcentaje, 10m, compraMinima: 20m, usosMaximos: 5, usosActuales: 4,
                desde: Ahora.AddDays(-1), hasta: Ahora.AddDays(1));

            Assert.Null(cupon.MotivoNoAplicable(20m, Ahora));
        }

        [Fact]
        public void MotivoNoAplicable_Inactivo()
        {
            var cupon = Cupon(TipoCupon.Porcentaje, 10m);
            cupon.Activo = false;

            Assert.Equal("El cupón no está activo.", cupon.MotivoNoAplicable(100m, Ahora));
        }

        [Fact]
        public void MotivoNoAplicable_FueraDeVigencia()
        {
            Assert.Equal("El cupón todavía no está vigente.",
                Cupon(TipoCupon.Porcentaje, 10m, desde: Ahora.AddMinutes(1)).MotivoNoAplicable(100m, Ahora));
            Assert.Equal("El cupón ya venció.",
                Cupon(TipoCupon.Porcentaje, 10m, hasta: Ahora).MotivoNoAplicable(100m, Ahora));
        }

        [Fact]
        public void MotivoNoAplicable_SinUsosDisponibles()
        {
            var cupon = Cupon(TipoCupon.MontoFijo, 5m, usosMaximos: 3, usosActuales: 3);

            Assert.Equal("El cupón ya alcanzó su límite de usos.", cupon.MotivoNoAplicable(100m, Ahora));
        }

        [Fact]
        public void MotivoNoAplicable_DebajoDeLaCompraMinima()
        {
            var cupon = Cupon(TipoCupon.MontoFijo, 5m, compraMinima: 30m);

            Assert.Equal("El cupón requiere una compra mínima de $30.00.", cupon.MotivoNoAplicable(29.99m, Ahora));
        }

        [Fact]
        public void NormalizarCodigo_QuitaEspaciosYPasaAMayusculas()
        {
            Assert.Equal("VERANO10", Core.Domain.Entidades.Cupon.NormalizarCodigo("  verano10 "));
        }

        private static Producto Producto(decimal precio, decimal? descuento = null, DateTime? desde = null,
            DateTime? hasta = null) => new()
        {
            CodigoSku = "SKU-1",
            Nombre = "Arroz",
            PrecioUsd = precio,
            DescuentoPorcentaje = descuento,
            DescuentoDesde = desde,
            DescuentoHasta = hasta,
        };

        private static Cupon Cupon(TipoCupon tipo, decimal valor, decimal? compraMinima = null, int? usosMaximos = null,
            int usosActuales = 0, DateTime? desde = null, DateTime? hasta = null) => new()
        {
            Codigo = "PRUEBA",
            Tipo = tipo,
            Valor = valor,
            CompraMinimaUsd = compraMinima,
            UsosMaximos = usosMaximos,
            UsosActuales = usosActuales,
            ValidoDesde = desde,
            ValidoHasta = hasta,
        };
    }
}
