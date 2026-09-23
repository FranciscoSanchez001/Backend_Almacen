using Backend_Almacen.Application.Servicios;
using Microsoft.Extensions.DependencyInjection;

namespace Backend_Almacen.Application
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
