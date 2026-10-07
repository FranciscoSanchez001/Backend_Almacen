using Core.Domain.Comun;
using Microsoft.AspNetCore.Mvc;
using NetArchTest.Rules;
using static ArchitectureTests.Capas;

namespace ArchitectureTests
{
    // Convenciones de nombres y ubicación que el resto del código da por hechas.
    public class ConvencionesTests
    {
        [Fact]
        public void Entidades_HeredanDeBaseEntity()
        {
            // Las clases estáticas anidadas (p. ej. Producto.ValoresPorDefecto) no son entidades.
            var resultado = Types.InAssembly(EnsambladoDominio)
                .That()
                .ResideInNamespace($"{Dominio}.Entidades")
                .And().AreClasses()
                .And().AreNotStatic()
                .Should()
                .Inherit(typeof(BaseEntity))
                .GetResult();

            Cumple(resultado);
        }

        [Fact]
        public void ContratosDeRepositorio_SonInterfacesDeAplicacion()
        {
            var resultado = Types.InAssembly(EnsambladoAplicacion)
                .That()
                .HaveNameEndingWith("Repository")
                .Should()
                .BeInterfaces()
                .And()
                .ResideInNamespace($"{Aplicacion}.Abstracciones")
                .GetResult();

            Cumple(resultado);
        }

        [Fact]
        public void InterfacesDeAplicacion_EmpiezanConI()
        {
            var resultado = Types.InAssembly(EnsambladoAplicacion)
                .That()
                .AreInterfaces()
                .Should()
                .HaveNameStartingWith("I")
                .GetResult();

            Cumple(resultado);
        }

        [Fact]
        public void Repositorios_EstanEnPersistenciaYSonClasesConcretas()
        {
            var resultado = Types.InAssembly(EnsambladoInfraestructura)
                .That()
                .HaveNameEndingWith("Repository")
                .Should()
                .ResideInNamespace($"{Infraestructura}.Persistencia.Repositorios")
                .And()
                .BeClasses()
                .And()
                .NotBeAbstract()
                .GetResult();

            Cumple(resultado);
        }

        [Fact]
        public void Validadores_TerminanEnValidator()
        {
            // ReglasUsuario es una clase estática auxiliar, no un validador.
            var resultado = Types.InAssemblies([EnsambladoAplicacion, EnsambladoPresentacion])
                .That()
                .ResideInNamespaceMatching(@"^(Core\.Application|Presentation\.API)\.Validadores$")
                .And().AreNotStatic()
                .Should()
                .HaveNameEndingWith("Validator")
                .GetResult();

            Cumple(resultado);
        }

        [Fact]
        public void Controladores_TerminanEnControllerYHeredanDeControllerBase()
        {
            var resultado = Types.InAssembly(EnsambladoPresentacion)
                .That()
                .ResideInNamespace($"{Presentacion}.Controllers")
                .And().AreClasses()
                .Should()
                .HaveNameEndingWith("Controller")
                .And()
                .Inherit(typeof(ControllerBase))
                .GetResult();

            Cumple(resultado);
        }

        [Fact]
        public void Controladores_SoloEstanEnSuEspacioDeNombres()
        {
            var resultado = Types.InAssembly(EnsambladoPresentacion)
                .That()
                .Inherit(typeof(ControllerBase))
                .Should()
                .ResideInNamespace($"{Presentacion}.Controllers")
                .GetResult();

            Cumple(resultado);
        }
    }
}
