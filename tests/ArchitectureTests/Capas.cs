using System.Reflection;
using Core.Application.Abstracciones;
using Core.Domain.Comun;
using Infrastructure.Persistencia;
using NetArchTest.Rules;
using Presentation.API.Controllers;

namespace ArchitectureTests
{
    // Ensamblados y espacios de nombres de cada capa, para no repetirlos en cada regla.
    internal static class Capas
    {
        public const string Dominio = "Core.Domain";
        public const string Aplicacion = "Core.Application";
        public const string Infraestructura = "Infrastructure";
        public const string Presentacion = "Presentation.API";

        public static readonly Assembly EnsambladoDominio = typeof(BaseEntity).Assembly;
        public static readonly Assembly EnsambladoAplicacion = typeof(IProductoRepository).Assembly;
        public static readonly Assembly EnsambladoInfraestructura = typeof(ApplicationDbContext).Assembly;
        public static readonly Assembly EnsambladoPresentacion = typeof(ProductosController).Assembly;

        // Falla con la lista de tipos que rompen la regla, para saber qué corregir.
        public static void Cumple(TestResult resultado)
        {
            var infractores = resultado.FailingTypeNames ?? [];
            Assert.True(resultado.IsSuccessful,
                "Tipos que no cumplen la regla:" + Environment.NewLine + string.Join(Environment.NewLine, infractores));
        }
    }
}
