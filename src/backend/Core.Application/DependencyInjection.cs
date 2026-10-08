using Core.Application.Servicios;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace Core.Application
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddApplication(this IServiceCollection services)
        {
            // Servicios de negocio: Scoped, porque usan los repositorios y el DbContext de la petición.
            services.AddScoped<IProductoService, ProductoService>();
            services.AddScoped<AuditoriaService>();
            services.AddScoped<TasaService>();
            services.AddScoped<InventarioService>();
            services.AddScoped<PedidosService>();
            services.AddScoped<ReportesService>();

            // Cola en memoria compartida con el worker de WhatsApp: una sola instancia.
            services.AddSingleton<ColaWhatsapp>();

            // Validadores de FluentValidation (Validadores/): Transient, no guardan estado.
            services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly, ServiceLifetime.Transient);
            return services;
        }
    }
}
