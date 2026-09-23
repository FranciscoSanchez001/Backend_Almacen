using Backend_Almacen.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure;

namespace Backend_Almacen.Data
{
    public class AlmacenDbContext(DbContextOptions<AlmacenDbContext> options) : DbContext(options)
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

        // Enums nativos de PostgreSQL; se registra en UseNpgsql (Program.cs).
        public static void MapEnums(NpgsqlDbContextOptionsBuilder npgsql)
        {
            npgsql.MapEnum<RolUsuario>("rol_usuario");
            npgsql.MapEnum<EstadoPedido>("estado_pedido");
            npgsql.MapEnum<MetodoPago>("metodo_pago");
            npgsql.MapEnum<MonedaPago>("moneda_pago");
            npgsql.MapEnum<TipoMovimientoInventario>("tipo_movimiento_inventario");
            npgsql.MapEnum<AccionAuditoria>("accion_auditoria");
            npgsql.MapEnum<TipoNotificacion>("tipo_notificacion");
            npgsql.MapEnum<EstadoMensajeWhatsapp>("estado_mensaje_whatsapp");
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Usuario>(e =>
            {
                e.Property(u => u.Nombre).HasMaxLength(150);
                e.Property(u => u.Email).HasMaxLength(254);
                e.Property(u => u.Telefono).HasMaxLength(20);
                e.HasIndex(u => u.Email).IsUnique();
                e.HasIndex(u => u.GoogleId).IsUnique();
                e.ToTable(t => t.HasCheckConstraint("ck_usuarios_credenciales",
                    "(rol = 'cliente' AND google_id IS NOT NULL) OR (rol <> 'cliente' AND password_hash IS NOT NULL)"));
            });

            modelBuilder.Entity<Categoria>(e =>
            {
                e.Property(c => c.Nombre).HasMaxLength(100);
                e.HasIndex(c => c.Nombre).IsUnique();
            });

            modelBuilder.Entity<Zona>(e =>
            {
                e.Property(z => z.Nombre).HasMaxLength(100);
                e.HasIndex(z => z.Nombre).IsUnique();
            });

            modelBuilder.Entity<Producto>(e =>
            {
                e.Property(p => p.Nombre).HasMaxLength(200);
                e.Property(p => p.PrecioUsd).HasPrecision(12, 2);
                e.Property(p => p.CreadoPorId).HasColumnName("creado_por");
                e.ToTable(t =>
                {
                    t.HasCheckConstraint("ck_productos_precio_usd", "precio_usd >= 0");
                    t.HasCheckConstraint("ck_productos_stock_disponible", "stock_disponible >= 0");
                    t.HasCheckConstraint("ck_productos_stock_reservado", "stock_reservado >= 0");
                });
            });

            modelBuilder.Entity<Pedido>(e =>
            {
                e.Property(p => p.TasaCambio).HasPrecision(14, 4);
                e.Property(p => p.TotalUsd).HasPrecision(12, 2);
                e.Property(p => p.TotalBs).HasPrecision(16, 2);
                e.Property(p => p.ReferenciaPago).HasMaxLength(100);
                e.Property(p => p.TelefonoContacto).HasMaxLength(20);
                e.Property(p => p.RevisadoPorId).HasColumnName("revisado_por");

                e.HasOne(p => p.Cliente).WithMany().HasForeignKey(p => p.ClienteId);
                e.HasOne(p => p.RevisadoPor).WithMany().HasForeignKey(p => p.RevisadoPorId);
                e.HasOne(p => p.Repartidor).WithMany().HasForeignKey(p => p.RepartidorId);

                // Índices para KPIs, Excel y el job de expiración.
                e.HasIndex(p => new { p.Estado, p.CreadoEn });
                e.HasIndex(p => new { p.Estado, p.ExpiraEn });
                e.HasIndex(p => p.ZonaId);

                e.ToTable(t =>
                {
                    t.HasCheckConstraint("ck_pedidos_totales", "total_usd >= 0 AND total_bs >= 0 AND tasa_cambio > 0");
                });
            });

            modelBuilder.Entity<PedidoItem>(e =>
            {
                e.Property(i => i.PrecioUsd).HasPrecision(12, 2);
                e.Property(i => i.PrecioBs).HasPrecision(16, 2);
                e.HasIndex(i => i.ProductoId);
                e.ToTable(t => t.HasCheckConstraint("ck_pedido_items_cantidad", "cantidad > 0"));
            });

            modelBuilder.Entity<MovimientoInventario>(e =>
            {
                e.HasIndex(m => new { m.ProductoId, m.CreadoEn });
            });

            modelBuilder.Entity<Auditoria>(e =>
            {
                e.Property(a => a.Entidad).HasMaxLength(50);
                e.Property(a => a.DatosAntes).HasColumnType("jsonb");
                e.Property(a => a.DatosDespues).HasColumnType("jsonb");
                e.HasIndex(a => a.CreadoEn);
                e.HasIndex(a => new { a.Entidad, a.EntidadId });
            });

            modelBuilder.Entity<Notificacion>(e =>
            {
                e.ToTable(t => t.HasCheckConstraint("ck_notificaciones_referencia",
                    "producto_id IS NOT NULL OR pedido_id IS NOT NULL"));
            });

            modelBuilder.Entity<MensajeWhatsapp>(e =>
            {
                e.Property(m => m.Telefono).HasMaxLength(20);
                e.Property(m => m.Plantilla).HasMaxLength(50);
            });

            modelBuilder.Entity<Configuracion>(e =>
            {
                e.ToTable("configuracion", t =>
                {
                    t.HasCheckConstraint("ck_configuracion_una_fila", "id = 1");
                    t.HasCheckConstraint("ck_configuracion_horas_expiracion", "horas_expiracion > 0");
                });
                e.Property(c => c.Id).ValueGeneratedNever();
                e.Property(c => c.TasaBsUsd).HasPrecision(14, 4);
                e.Property(c => c.NumeroSoporte).HasMaxLength(20);
                e.Property(c => c.HorasExpiracion).HasDefaultValue(5);
                e.Property(c => c.NumerosPrueba).HasDefaultValueSql("'{}'");
                // La fila única se inserta en la migración InitialCreate (HasData no compara
                // bien listas y deja el modelo con cambios pendientes).
            });

            modelBuilder.Entity<HistorialTasa>(e =>
            {
                e.Property(h => h.Tasa).HasPrecision(14, 4);
                e.ToTable(t => t.HasCheckConstraint("ck_historial_tasas_tasa", "tasa > 0"));
            });

            // Nada se borra en cascada: el historial de pedidos, auditoría e inventario no debe
            // perderse. Solo los ítems y el historial de estados siguen a su pedido.
            foreach (var fk in modelBuilder.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()))
            {
                var dependiente = fk.DeclaringEntityType.ClrType;
                var sigueAlPedido = fk.PrincipalEntityType.ClrType == typeof(Pedido)
                    && (dependiente == typeof(PedidoItem) || dependiente == typeof(HistorialEstadoPedido));
                fk.DeleteBehavior = sigueAlPedido ? DeleteBehavior.Cascade : DeleteBehavior.Restrict;
            }

            foreach (var entity in modelBuilder.Model.GetEntityTypes())
            {
                entity.FindProperty(nameof(Pedido.CreadoEn))?.SetDefaultValueSql("now()");
            }
        }
    }
}
