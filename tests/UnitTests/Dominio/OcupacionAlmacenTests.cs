using Core.Domain.Reglas;

namespace UnitTests.Dominio
{
    // KPI de ocupación del almacén (Core.Domain), sin dependencias.
    public class OcupacionAlmacenTests
    {
        [Theory]
        [InlineData(50, 100, 50.0)]
        [InlineData(1, 3, 33.3)]    // redondea a un decimal
        [InlineData(0, 100, 0.0)]
        [InlineData(130, 100, 130.0)] // puede superar la capacidad
        public void Porcentaje_DivideUnidadesEntreCapacidad(int unidades, int capacidad, double esperado)
        {
            var porcentaje = OcupacionAlmacen.Porcentaje(unidades, capacidad);

            Assert.Equal((decimal)esperado, porcentaje);
        }

        [Fact]
        public void Porcentaje_SinCapacidad_EsNull()
        {
            Assert.Null(OcupacionAlmacen.Porcentaje(10, 0));
        }

        [Theory]
        [InlineData(0, NivelOcupacion.Baja)]
        [InlineData(19.9, NivelOcupacion.Baja)]
        [InlineData(20, NivelOcupacion.Optima)]
        [InlineData(84.9, NivelOcupacion.Optima)]
        [InlineData(85, NivelOcupacion.Alta)]
        [InlineData(100, NivelOcupacion.Alta)]       // llena, pero no excedida
        [InlineData(100.1, NivelOcupacion.Saturada)]
        public void Clasificar_UsaLosLimitesDelSemaforo(double porcentaje, NivelOcupacion esperado)
        {
            Assert.Equal(esperado, OcupacionAlmacen.Clasificar((decimal)porcentaje));
        }
    }
}
