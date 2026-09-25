using Core.Application.Servicios;
using Microsoft.Extensions.DependencyInjection;

namespace Core.Application
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddApplication(this IServiceCollection services)
        {
            services.AddScoped<AuditoriaService>();
            services.AddScoped<TasaService>();
            services.AddScoped<InventarioService>();
            services.AddScoped<PedidosService>();
            services.AddScoped<ReportesService>();
            services.AddSingleton<ColaWhatsapp>();
            return services;
        }
    }
}
