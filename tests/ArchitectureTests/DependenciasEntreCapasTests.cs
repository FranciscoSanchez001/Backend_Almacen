using NetArchTest.Rules;
using static ArchitectureTests.Capas;

namespace ArchitectureTests
{
    // Regla de dependencia de la arquitectura limpia: las referencias solo apuntan hacia adentro.
    //   Presentation.API → Infrastructure → Core.Application → Core.Domain
    // Además, el núcleo (Domain y Application) no conoce EF Core, Npgsql ni ASP.NET Core.
    public class DependenciasEntreCapasTests
    {
        [Fact]
        public void Dominio_NoDependeDeNingunaOtraCapa()
        {
            var resultado = Types.InAssembly(EnsambladoDominio)
                .ShouldNot()
                .HaveDependencyOnAny(Aplicacion, Infraestructura, Presentacion)
                .GetResult();

            Cumple(resultado);
        }

        [Fact]
        public void Dominio_NoDependeDeFrameworksExternos()
        {
            var resultado = Types.InAssembly(EnsambladoDominio)
                .ShouldNot()
                .HaveDependencyOnAny("Microsoft.EntityFrameworkCore", "Npgsql", "Microsoft.AspNetCore", "FluentValidation")
                .GetResult();

            Cumple(resultado);
        }

        [Fact]
        public void Aplicacion_NoDependeDeInfraestructuraNiDePresentacion()
        {
            var resultado = Types.InAssembly(EnsambladoAplicacion)
                .ShouldNot()
                .HaveDependencyOnAny(Infraestructura, Presentacion)
                .GetResult();

            Cumple(resultado);
        }

        [Fact]
        public void Aplicacion_NoDependeDeEfCoreNiDeAspNetCore()
        {
            var resultado = Types.InAssembly(EnsambladoAplicacion)
                .ShouldNot()
                .HaveDependencyOnAny("Microsoft.EntityFrameworkCore", "Npgsql", "Microsoft.AspNetCore")
                .GetResult();

            Cumple(resultado);
        }

        [Fact]
        public void Infraestructura_NoDependeDePresentacion()
        {
            var resultado = Types.InAssembly(EnsambladoInfraestructura)
                .ShouldNot()
                .HaveDependencyOn(Presentacion)
                .GetResult();

            Cumple(resultado);
        }

        // Los controladores trabajan con los contratos de Application; solo Program.cs conoce
        // Infrastructure, para registrar las implementaciones.
        [Fact]
        public void Controladores_NoDependenDeInfraestructuraNiDeEfCore()
        {
            var resultado = Types.InAssembly(EnsambladoPresentacion)
                .That()
                .ResideInNamespace($"{Presentacion}.Controllers")
                .ShouldNot()
                .HaveDependencyOnAny(Infraestructura, "Microsoft.EntityFrameworkCore")
                .GetResult();

            Cumple(resultado);
        }
    }
}
