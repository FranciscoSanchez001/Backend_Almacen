using System.Reflection;
using Backend_Almacen.Domain.Entidades;
using Backend_Almacen.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure;

namespace Backend_Almacen.Infrastructure.Persistencia
{
    public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
    {
        public DbSet<Usuario> Usuarios => Set<Usuario>();
        public DbSet<Categoria> Categorias => Set<Categoria>();
        public DbSet<Zona> Zonas => Set<Zona>();
        public DbSet<Producto> Productos => Set<Producto>();
        public DbSet<Pedido> Pedidos => Set<Pedido>();
        public DbSet<PedidoItem> PedidoItems => Set<PedidoItem>();
        public DbSet<HistorialEstadoPedido> HistorialEstadosPedido => Set<HistorialEstadoPedido>();
        public DbSet<MovimientoInventario> MovimientosInventario => Set<MovimientoInventario>();
        public DbSet<Auditoria> Auditoria => Set<Auditoria>();
        public DbSet<Notificacion> Notificaciones => Set<Notificacion>();
        public DbSet<MensajeWhatsapp> MensajesWhatsapp => Set<MensajeWhatsapp>();
        public DbSet<Configuracion> Configuracion => Set<Configuracion>();
        public DbSet<HistorialTasa> HistorialTasas => Set<HistorialTasa>();

        // Enums nativos de PostgreSQL; se registra en UseNpgsql (DependencyInjection.cs).
        public static void ConfigurarNpgsql(NpgsqlDbContextOptionsBuilder npgsql)
        {
            npgsql.MapEnum<RolUsuario>("rol_usuario");
            npgsql.MapEnum<EstadoPedido>("estado_pedido");
            npgsql.MapEnum<MetodoPago>("metodo_pago");
            npgsql.MapEnum<MonedaPago>("moneda_pago", nameTranslator: NombresEnMayusculas.Instancia);
            npgsql.MapEnum<TipoMovimientoInventario>("tipo_movimiento_inventario");
            npgsql.MapEnum<AccionAuditoria>("accion_auditoria");
            npgsql.MapEnum<TipoNotificacion>("tipo_notificacion");
            npgsql.MapEnum<EstadoMensajeWhatsapp>("estado_mensaje_whatsapp");
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Cada entidad tiene su IEntityTypeConfiguration<T> en Persistencia/Configuraciones.
            modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
        }

        // MonedaPago se guarda como VES / USDT. Instancia única: EF compara las opciones del
        // DbContext por referencia, y una instancia nueva por petición le haría construir un
        // proveedor de servicios interno cada vez.
        private sealed class NombresEnMayusculas : INpgsqlNameTranslator
        {
            public static readonly NombresEnMayusculas Instancia = new();

            public string TranslateTypeName(string clrName) => clrName.ToLowerInvariant();
            public string TranslateMemberName(string clrName) => clrName.ToUpperInvariant();
        }
    }
}
