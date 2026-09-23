using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Application.Servicios;
using Backend_Almacen.Infrastructure.Reportes;
using Backend_Almacen.Infrastructure.Archivos;
using Backend_Almacen.Infrastructure.Jobs;
using Backend_Almacen.Infrastructure.Mensajeria;
using Backend_Almacen.Infrastructure.Persistencia;
using Backend_Almacen.Infrastructure.Persistencia.Repositorios;
using Backend_Almacen.Infrastructure.Seguridad;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Backend_Almacen.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuracion)
        {
            services.AddDbContext<ApplicationDbContext>(options => options
                .UseNpgsql(configuracion.GetConnectionString("Almacen"), ApplicationDbContext.ConfigurarNpgsql)
                .UseSnakeCaseNamingConvention());

            // Repositorios y unidad de trabajo: comparten el DbContext de la petición.
            services.AddScoped<IUnitOfWork, UnitOfWork>();
            services.AddScoped<IUsuarioRepository, UsuarioRepository>();
            services.AddScoped<ICategoriaRepository, CategoriaRepository>();
            services.AddScoped<IZonaRepository, ZonaRepository>();
            services.AddScoped<IProductoRepository, ProductoRepository>();
            services.AddScoped<IInventarioRepository, InventarioRepository>();
            services.AddScoped<IPedidoRepository, PedidoRepository>();
            services.AddScoped<INotificacionRepository, NotificacionRepository>();
            services.AddScoped<IConfiguracionRepository, ConfiguracionRepository>();
            services.AddScoped<IAuditoriaRepository, AuditoriaRepository>();
            services.AddScoped<IMensajeWhatsappRepository, MensajeWhatsappRepository>();
            services.AddScoped<IDiagnosticoBaseDatos, DiagnosticoBaseDatos>();
            services.AddScoped<IReportesRepository, ReportesRepository>();

            // KPIs e informe en Excel.
            services.AddSingleton(configuracion.GetSection("Reportes").Get<ReportesOptions>() ?? new ReportesOptions());
            services.AddSingleton<IGeneradorExcel, GeneradorExcel>();

            services.AddSingleton<IHasherContrasenas, HasherBcrypt>();

            // Capturas de pago: Cloudinary si está configurado; si no, disco local (solo desarrollo).
            var cloudinary = configuracion.GetSection("Cloudinary").Get<CloudinaryOptions>() ?? new CloudinaryOptions();
            if (cloudinary.Configurado)
            {
                services.AddSingleton(cloudinary);
                services.AddSingleton<IAlmacenamientoArchivos, AlmacenamientoCloudinary>();
            }
            else
            {
                services.AddSingleton<AlmacenamientoLocal>();
                services.AddSingleton<IAlmacenamientoArchivos>(sp => sp.GetRequiredService<AlmacenamientoLocal>());
            }

            // WhatsApp: el worker consume la cola de Application y llama al servicio de Baileys.
            services.AddSingleton(configuracion.GetSection("Whatsapp").Get<WhatsappOptions>() ?? new WhatsappOptions());
            services.AddHttpClient(nameof(EnvioWhatsappWorker), c => c.Timeout = TimeSpan.FromSeconds(15));
            services.AddHostedService<EnvioWhatsappWorker>();

            // Job de expiración de pedidos pendientes.
            services.AddSingleton(configuracion.GetSection("Expiracion").Get<ExpiracionOptions>() ?? new ExpiracionOptions());
            services.AddHostedService<ExpiracionPedidosJob>();

            return services;
        }
    }
}
