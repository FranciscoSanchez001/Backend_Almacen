using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Application.Servicios;
using Backend_Almacen.Domain.Entidades;
using Backend_Almacen.Domain.Enums;
using Bogus;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Backend_Almacen.Infrastructure.Persistencia.Semillas
{
    public class SiembraDemoOptions
    {
        public bool Habilitada { get; set; }

        // Días de operación simulados hasta hoy.
        public int Dias { get; set; } = 90;
        public int Clientes { get; set; } = 60;

        // Contraseña del personal de demostración (ventas1..2, repartidor1..3 @almacen.local).
        public string Password { get; set; } = "Demo1234!";

        // Misma semilla = mismos datos.
        public int Semilla { get; set; } = 2026;
    }

    // Datos de demostración para desarrollo: personal, clientes, productos extra, historial de
    // tasas y unos meses de pedidos, para que el dashboard, el Excel y los paneles tengan con qué
    // trabajar. Se ejecuta a pedido:
    //
    //     dotnet run --project WebAPI -- --SiembraDemo:Habilitada=true
    //
    // Solo en Development, solo si la base no tiene pedidos, y en una sola transacción.
    public static class SembradorDemo
    {
        public static async Task SembrarDatosDemoAsync(this IServiceProvider services, IConfiguration configuracion,
            CancellationToken ct = default)
        {
            var opciones = configuracion.GetSection("SiembraDemo").Get<SiembraDemoOptions>() ?? new SiembraDemoOptions();
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<ApplicationDbContext>>();

            if (await db.Pedidos.AnyAsync(ct))
            {
                logger.LogInformation("Siembra de demostración omitida: la base ya tiene pedidos.");
                return;
            }
            if (await db.Usuarios.AnyAsync(u => u.Email.EndsWith("@almacen.local")
                    && (u.Email.StartsWith("ventas") || u.Email.StartsWith("repartidor")), ct))
            {
                logger.LogInformation("Siembra de demostración omitida: ya existe personal de demostración (ventasN / repartidorN).");
                return;
            }
            var superadmin = await db.Usuarios.FirstOrDefaultAsync(u => u.Rol == RolUsuario.Superadmin, ct);
            if (superadmin is null)
            {
                logger.LogWarning("Siembra de demostración omitida: falta el superadmin inicial (sección SuperadminInicial).");
                return;
            }

            var zona = TimeZoneInfo.FindSystemTimeZoneById(scope.ServiceProvider.GetRequiredService<ReportesOptions>().ZonaHoraria);
            var generador = new GeneradorDemo(db, scope.ServiceProvider.GetRequiredService<IHasherContrasenas>(), opciones,
                zona, superadmin, DateTime.UtcNow);

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var resumen = await generador.GenerarAsync(ct);
            await tx.CommitAsync(ct);
            logger.LogInformation("Siembra de demostración completada: {Resumen}", resumen);
        }
    }

    // Simulación cronológica: cada pedido reserva stock al crearse y, al revisarse, lo vende o lo
    // libera, igual que PedidosService e InventarioService. Así el stock nunca queda negativo y
    // los movimientos, el historial de estados y la auditoría cuadran con los pedidos.
    internal sealed class GeneradorDemo(
        ApplicationDbContext db,
        IHasherContrasenas hasher,
        SiembraDemoOptions op,
        TimeZoneInfo zona,
        Usuario admin,
        DateTime ahora)
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
        {
            Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) },
        };

        // Pedidos por hora local (de 7 a 22).
        private static readonly (int Hora, float Peso)[] Horas =
            [(7, 2), (8, 4), (9, 6), (10, 8), (11, 10), (12, 11), (13, 9), (14, 6), (15, 6), (16, 7), (17, 9), (18, 11),
             (19, 10), (20, 7), (21, 4), (22, 2)];

        private readonly Faker f = new("es") { Random = new Randomizer(op.Semilla) };
        private readonly PriorityQueue<Action, (DateTime, long)> eventos = new();
        private long secuencia;

        private readonly Dictionary<Guid, Stock> stock = new();
        private readonly List<Pedido> pedidos = [];
        private readonly List<MovimientoInventario> movimientos = [];
        private readonly List<Notificacion> notificaciones = [];
        private readonly List<Auditoria> auditorias = [];
        private readonly List<(DateTime Utc, decimal Tasa)> tasas = [];

        private List<Usuario> vendedores = [];
        private List<Usuario> repartidores = [];
        private List<Usuario> clientes = [];
        private float[] pesoClientes = [];
        private List<(Zona Zona, double Lat, double Lng, float Peso)> zonas = [];
        private int horasExpiracion;

        private sealed class Stock(Producto producto, float peso)
        {
            public Producto Producto { get; } = producto;
            public float Peso { get; } = peso;
            public int Disponible { get; set; } = producto.StockDisponible;
            public int Reservado { get; set; } = producto.StockReservado;
            public DateTime Ultimo { get; set; }
            public bool Reponible { get; set; } = true;
            public bool ReposicionPendiente { get; set; }
            public Notificacion? Agotado { get; set; }
        }

        public async Task<string> GenerarAsync(CancellationToken ct)
        {
            var hoy = DateOnly.FromDateTime(Local(ahora));
            var primerDia = hoy.AddDays(-(op.Dias - 1));
            var arranque = Utc(primerDia.AddDays(-3), new TimeOnly(9, 0));

            var config = await db.Configuracion.SingleAsync(c => c.Id == Configuracion.IdUnico, ct);
            horasExpiracion = config.HorasExpiracion;

            CrearPersonal(arranque);
            CrearClientes(arranque);
            await CargarZonasAsync(ct);
            await CargarProductosAsync(arranque, ct);
            CrearTasas(primerDia.AddDays(-1), hoy, config);
            ConfigurarTienda(config, arranque);
            await db.SaveChangesAsync(ct);

            PlanificarPedidos(primerDia, hoy);
            // Dos productos se agotan hacia el final y no se reponen: así "productos sin stock"
            // y las notificaciones de agotado tienen datos.
            Programar(ahora.AddHours(-30), () => Agotar(ahora.AddHours(-30)));
            while (eventos.TryDequeue(out var evento, out _))
            {
                evento();
            }

            foreach (var s in stock.Values)
            {
                s.Producto.StockDisponible = s.Disponible;
                s.Producto.StockReservado = s.Reservado;
            }

            // En orden cronológico, para que el número correlativo (identity) siga la fecha.
            foreach (var lote in pedidos.OrderBy(p => p.CreadoEn).Chunk(200))
            {
                db.Pedidos.AddRange(lote);
                await db.SaveChangesAsync(ct);
            }
            db.MovimientosInventario.AddRange(movimientos);
            db.Notificaciones.AddRange(notificaciones);
            db.Auditoria.AddRange(auditorias);
            await db.SaveChangesAsync(ct);

            return $"{vendedores.Count + repartidores.Count} empleados, {clientes.Count} clientes, {stock.Count} productos, " +
                   $"{tasas.Count} tasas, {pedidos.Count} pedidos, {pedidos.Sum(p => p.Items.Count)} ítems, " +
                   $"{movimientos.Count} movimientos, {notificaciones.Count} notificaciones, {auditorias.Count} auditorías. " +
                   $"Personal: ventas1..{vendedores.Count}@almacen.local y repartidor1..{repartidores.Count}@almacen.local " +
                   "(contraseña en SiembraDemo:Password).";
        }

        // ---- Datos maestros ----

        private void CrearPersonal(DateTime creado)
        {
            var hash = hasher.Hash(op.Password);
            Usuario Nuevo(string email, RolUsuario rol) => new()
            {
                Id = Guid.CreateVersion7(creado),
                Nombre = $"{f.Name.FirstName()} {f.Name.LastName()}",
                Email = email,
                Telefono = Telefono(),
                Rol = rol,
                PasswordHash = hash,
                CreadoEn = creado,
            };

            vendedores = [Nuevo("ventas1@almacen.local", RolUsuario.Ventas), Nuevo("ventas2@almacen.local", RolUsuario.Ventas)];
            repartidores = Enumerable.Range(1, 3).Select(i => Nuevo($"repartidor{i}@almacen.local", RolUsuario.Repartidor)).ToList();
            foreach (var u in vendedores.Concat(repartidores))
            {
                db.Usuarios.Add(u);
                Auditar(admin.Id, Entidades.Usuario, u.Id, AccionAuditoria.Crear, null,
                    new { u.Nombre, u.Email, u.Telefono, u.Rol, u.Activo }, creado);
            }
        }

        private void CrearClientes(DateTime antesDe)
        {
            var correos = new HashSet<string>();
            for (var i = 0; i < op.Clientes; i++)
            {
                var nombre = f.Name.FirstName();
                var apellido = f.Name.LastName();
                string correo;
                do
                {
                    correo = $"{SinAcentos(nombre)}.{SinAcentos(apellido)}{f.Random.Number(1, 99)}@gmail.com";
                }
                while (!correos.Add(correo));

                var creado = antesDe.AddDays(-f.Random.Int(1, 120)).AddMinutes(f.Random.Int(0, 600));
                clientes.Add(new Usuario
                {
                    Id = Guid.CreateVersion7(creado),
                    Nombre = $"{nombre} {apellido}",
                    Email = correo,
                    Telefono = Telefono(),
                    Rol = RolUsuario.Cliente,
                    GoogleId = "demo-" + f.Random.ReplaceNumbers("#####################"),
                    CreadoEn = creado,
                });
            }
            db.Usuarios.AddRange(clientes);
            // Pocos clientes hacen muchos pedidos y muchos hacen pocos.
            pesoClientes = clientes.Select((_, i) => (float)(1 / Math.Pow(i + 1, 0.6))).ToArray();
        }

        private async Task CargarZonasAsync(CancellationToken ct)
        {
            var activas = await db.Zonas.Where(z => z.Activa).OrderBy(z => z.Nombre).ToListAsync(ct);
            zonas = activas.Select(z => CatalogoDemo.Zonas.TryGetValue(z.Nombre, out var c)
                    ? (z, c.Lat, c.Lng, (float)c.Peso)
                    : (z, 7.7669, -72.2250, 10f))
                .ToList();
            if (zonas.Count == 0)
            {
                throw new InvalidOperationException("No hay zonas activas para sembrar pedidos.");
            }
        }

        private async Task CargarProductosAsync(DateTime creado, CancellationToken ct)
        {
            var categorias = await db.Categorias.Select(c => c.Id).ToListAsync(ct);
            var skus = await db.Productos.Select(p => p.CodigoSku).ToListAsync(ct);
            foreach (var d in CatalogoDemo.Productos.Where(d => !skus.Contains(d.Sku) && categorias.Contains(d.CategoriaId)))
            {
                var producto = new Producto
                {
                    Id = Guid.CreateVersion7(creado),
                    CodigoSku = d.Sku,
                    Nombre = d.Nombre,
                    Descripcion = d.Descripcion,
                    PrecioUsd = d.PrecioUsd,
                    CostoUsd = d.CostoUsd,
                    CategoriaId = d.CategoriaId,
                    StockDisponible = f.Random.Int(40, 120),
                    CreadoPorId = admin.Id,
                    CreadoEn = creado,
                };
                db.Productos.Add(producto);
                Movimiento(producto.Id, null, admin.Id, TipoMovimientoInventario.Reposicion, producto.StockDisponible, 0,
                    producto.StockDisponible, creado);
                Auditar(admin.Id, Entidades.Producto, producto.Id, AccionAuditoria.Crear, null, new
                {
                    producto.CodigoSku, producto.Nombre, producto.Descripcion, producto.PrecioUsd, producto.CostoUsd,
                    producto.ImagenUrl, producto.CategoriaId, producto.StockDisponible, producto.Activo,
                }, creado);
            }

            // Incluye los recién agregados (siguen en el ChangeTracker) y los de la semilla de la Fase 2.
            var productos = db.ChangeTracker.Entries<Producto>().Select(e => e.Entity)
                .Concat(await db.Productos.Where(p => p.Activo).ToListAsync(ct))
                .DistinctBy(p => p.Id)
                .Where(p => p.Activo);
            foreach (var p in productos)
            {
                stock[p.Id] = new Stock(p, (float)CatalogoDemo.Popularidad.GetValueOrDefault(p.CodigoSku, 3)) { Ultimo = creado };
            }
        }

        // Una tasa por día a las 08:30 hora local, subiendo poco a poco.
        private void CrearTasas(DateOnly desde, DateOnly hasta, Configuracion config)
        {
            var tasa = 36.50m;
            for (var dia = desde; dia <= hasta; dia = dia.AddDays(1))
            {
                var cuando = Utc(dia, new TimeOnly(8, 30));
                if (cuando > ahora)
                {
                    break;
                }
                tasa = Math.Round(tasa * (1 + (decimal)f.Random.Double(0.0005, 0.004)), 2);
                tasas.Add((cuando, tasa));
                db.HistorialTasas.Add(new HistorialTasa { Id = Guid.CreateVersion7(cuando), Tasa = tasa, UsuarioId = admin.Id, CreadoEn = cuando });
            }
            config.TasaBsUsd = tasas[^1].Tasa;
        }

        // Datos de pago de ejemplo, solo donde la configuración está vacía.
        private void ConfigurarTienda(Configuracion config, DateTime cuando)
        {
            var antes = new { config.NumeroSoporte, config.DatosTransferencia, config.DatosPagoMovil, config.WalletBinance };
            config.NumeroSoporte ??= "+584247000000";
            config.DatosTransferencia ??= "Banco de Venezuela · Cuenta corriente 0102-0000-00-0000000000 · Supermercado Demo C.A. · RIF J-00000000-0";
            config.DatosPagoMovil ??= "Banco de Venezuela (0102) · RIF J-00000000-0 · 0424-700-0000";
            config.WalletBinance ??= "supermercado.demo@binance";
            Auditar(admin.Id, Entidades.Configuracion, config.Id, AccionAuditoria.Editar, antes,
                new { config.NumeroSoporte, config.DatosTransferencia, config.DatosPagoMovil, config.WalletBinance }, cuando);
        }

        // ---- Pedidos ----

        // Más pedidos a medida que pasan los días (crecimiento) y los fines de semana.
        private void PlanificarPedidos(DateOnly primerDia, DateOnly hoy)
        {
            var dias = hoy.DayNumber - primerDia.DayNumber;
            for (var dia = primerDia; dia <= hoy; dia = dia.AddDays(1))
            {
                var progreso = dias == 0 ? 1 : (double)(dia.DayNumber - primerDia.DayNumber) / dias;
                var finDeSemana = dia.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
                var cantidad = Math.Max(1, (int)Math.Round(4 + 4 * progreso + (finDeSemana ? 2 : 0) + f.Random.Double(-1.5, 1.5)));
                for (var i = 0; i < cantidad; i++)
                {
                    var hora = Elegir(Horas.Select(h => h.Hora).ToArray(), Horas.Select(h => h.Peso).ToArray());
                    var creado = Utc(dia, new TimeOnly(hora, f.Random.Int(0, 59), f.Random.Int(0, 59)));
                    if (creado < ahora.AddMinutes(-2))
                    {
                        Programar(creado, () => CrearPedido(creado));
                    }
                }
            }

            // Unos pedidos de las últimas horas, para que la bandeja de ventas y el panel del
            // repartidor tengan trabajo en curso a cualquier hora en que se siembre.
            for (var i = 0; i < 6; i++)
            {
                var creado = ahora.AddMinutes(-f.Random.Int(10, 200));
                Programar(creado, () => CrearPedido(creado));
            }
        }

        private void CrearPedido(DateTime creado)
        {
            var cliente = Elegir(clientes.ToArray(), pesoClientes);
            var tasa = TasaEn(creado);

            // Productos distintos, más probables los populares.
            var candidatos = stock.Values.Where(s => s.Reponible || s.Disponible > 0).ToList();
            var cuantos = Elegir([1, 2, 3, 4, 5, 6], [15f, 25f, 25f, 18f, 10f, 7f]);
            var elegidos = new List<Stock>();
            while (elegidos.Count < Math.Min(cuantos, candidatos.Count))
            {
                var s = Elegir(candidatos.ToArray(), candidatos.Select(c => c.Peso).ToArray());
                candidatos.Remove(s);
                elegidos.Add(s);
            }

            var pedido = new Pedido
            {
                Id = Guid.CreateVersion7(creado),
                ClienteId = cliente.Id,
                MetodoPago = Elegir([MetodoPago.PagoMovil, MetodoPago.Transferencia, MetodoPago.Binance], [50f, 30f, 20f]),
                TasaCambio = tasa,
                DireccionTexto = Direccion(),
                TelefonoContacto = cliente.Telefono!,
                CreadoEn = creado,
                ExpiraEn = creado.AddHours(horasExpiracion),
            };
            pedido.MonedaPago = pedido.MetodoPago == MetodoPago.Binance ? MonedaPago.Usdt : MonedaPago.Ves;
            pedido.ReferenciaPago = pedido.MetodoPago == MetodoPago.Binance
                ? f.Random.ReplaceNumbers("3##################")
                : f.Random.ReplaceNumbers("0###########");
            var (zonaElegida, lat, lng, _) = Elegir(zonas.ToArray(), zonas.Select(z => z.Peso).ToArray());
            pedido.ZonaId = zonaElegida.Id;
            if (f.Random.Bool(0.85f))
            {
                pedido.Latitud = Math.Round(lat + f.Random.Double(-0.004, 0.004), 6);
                pedido.Longitud = Math.Round(lng + f.Random.Double(-0.004, 0.004), 6);
            }

            foreach (var s in elegidos)
            {
                var cantidad = s.Peso >= 6 ? f.Random.Int(1, 6) : f.Random.Int(1, 3);
                if (s.Disponible < cantidad)
                {
                    if (!s.Reponible)
                    {
                        continue;
                    }
                    // Llegó mercancía justo antes.
                    Reponer(s, Max(s.Ultimo.AddSeconds(1), creado.AddMinutes(-f.Random.Int(5, 40))), cantidad + f.Random.Int(40, 100));
                }

                var antes = s.Disponible;
                s.Disponible -= cantidad;
                s.Reservado += cantidad;
                s.Ultimo = creado;
                Movimiento(s.Producto.Id, pedido.Id, cliente.Id, TipoMovimientoInventario.Reserva, -cantidad, antes, s.Disponible, creado);
                if (s.Disponible == 0)
                {
                    NotificarAgotado(s, creado);
                }
                else if (s.Disponible < 12 && s.Reponible && !s.ReposicionPendiente)
                {
                    // Ventas pide mercancía y llega unas horas después.
                    s.ReposicionPendiente = true;
                    var llega = creado.AddHours(f.Random.Double(2, 20));
                    if (llega < ahora)
                    {
                        Programar(llega, () =>
                        {
                            s.ReposicionPendiente = false;
                            if (s.Reponible)
                            {
                                Reponer(s, Max(s.Ultimo.AddSeconds(1), llega), f.Random.Int(60, 140));
                            }
                        });
                    }
                }

                pedido.Items.Add(new PedidoItem
                {
                    Id = Guid.CreateVersion7(creado),
                    PedidoId = pedido.Id,
                    ProductoId = s.Producto.Id,
                    CategoriaId = s.Producto.CategoriaId,
                    Cantidad = cantidad,
                    PrecioUsd = s.Producto.PrecioUsd,
                    PrecioBs = Math.Round(s.Producto.PrecioUsd * tasa, 2, MidpointRounding.AwayFromZero),
                });
            }
            if (pedido.Items.Count == 0)
            {
                return;
            }

            pedido.TotalUsd = pedido.Items.Sum(i => i.PrecioUsd * i.Cantidad);
            pedido.TotalBs = pedido.Items.Sum(i => i.PrecioBs * i.Cantidad);
            Historial(pedido, null, EstadoPedido.Pendiente, cliente.Id, creado);
            pedidos.Add(pedido);
            DecidirDestino(pedido);
        }

        // 82 % aprobados, 11 % rechazados y 7 % expirados; lo que todavía no pasó queda en su
        // estado actual (pendiente, asignado o en camino).
        private void DecidirDestino(Pedido pedido)
        {
            var creado = pedido.CreadoEn;
            var sorteo = f.Random.Double();
            var nuevo = new Notificacion { Id = Guid.CreateVersion7(creado), Tipo = TipoNotificacion.PedidoNuevo, PedidoId = pedido.Id, CreadoEn = creado };
            notificaciones.Add(nuevo);

            if (sorteo >= 0.93)
            {
                if (pedido.ExpiraEn <= ahora)
                {
                    nuevo.Leida = true;
                    notificaciones.Add(new Notificacion
                    {
                        Id = Guid.CreateVersion7(pedido.ExpiraEn.AddHours(-1)), Tipo = TipoNotificacion.PedidoPorExpirar,
                        PedidoId = pedido.Id, Leida = true, CreadoEn = pedido.ExpiraEn.AddHours(-1),
                    });
                    Programar(pedido.ExpiraEn, () => Expirar(pedido));
                }
                else
                {
                    AvisoPendiente(pedido);
                }
                return;
            }

            var revisado = creado.AddMinutes(f.Random.Int(4, Math.Min(170, horasExpiracion * 60 - 1)));
            // Los de las últimas horas: la mitad todavía sin revisar.
            if (revisado > ahora || (creado > ahora.AddHours(-4) && f.Random.Bool(0.5f)))
            {
                AvisoPendiente(pedido);
                return;
            }
            nuevo.Leida = true;
            var revisor = Elegir([vendedores[0], vendedores[1], admin], [60f, 30f, 10f]);
            if (sorteo < 0.82)
            {
                Programar(revisado, () => Aprobar(pedido, revisor, revisado));
            }
            else
            {
                Programar(revisado, () => Rechazar(pedido, revisor, revisado));
            }
        }

        private void AvisoPendiente(Pedido pedido)
        {
            var aviso = pedido.ExpiraEn.AddHours(-1);
            if (aviso <= ahora)
            {
                notificaciones.Add(new Notificacion
                {
                    Id = Guid.CreateVersion7(aviso), Tipo = TipoNotificacion.PedidoPorExpirar, PedidoId = pedido.Id, CreadoEn = aviso,
                });
            }
        }

        private void Aprobar(Pedido pedido, Usuario revisor, DateTime cuando)
        {
            foreach (var item in pedido.Items)
            {
                var s = stock[item.ProductoId];
                s.Reservado -= item.Cantidad;
                s.Ultimo = Max(s.Ultimo, cuando);
                Movimiento(item.ProductoId, pedido.Id, revisor.Id, TipoMovimientoInventario.Venta, -item.Cantidad, s.Disponible,
                    s.Disponible, cuando);
            }

            var repartidor = Elegir(repartidores.ToArray(), [45f, 35f, 20f]);
            pedido.RevisadoPorId = revisor.Id;
            pedido.RevisadoEn = cuando;
            pedido.RepartidorId = repartidor.Id;
            pedido.AsignadoEn = cuando;
            Historial(pedido, EstadoPedido.Pendiente, EstadoPedido.Aprobado, revisor.Id, cuando);
            Historial(pedido, EstadoPedido.Aprobado, EstadoPedido.Asignado, revisor.Id, cuando);
            pedido.Estado = EstadoPedido.Asignado;

            // Los aprobados en las últimas horas pueden seguir por entregar.
            var reciente = cuando > ahora.AddHours(-6);
            var enCamino = cuando.AddMinutes(f.Random.Int(10, 90));
            if (enCamino > ahora || (reciente && f.Random.Bool(0.4f)))
            {
                return;
            }
            pedido.EnCaminoEn = enCamino;
            Historial(pedido, EstadoPedido.Asignado, EstadoPedido.EnCamino, repartidor.Id, enCamino);
            pedido.Estado = EstadoPedido.EnCamino;

            var entregado = enCamino.AddMinutes(f.Random.Int(15, 75));
            if (entregado > ahora || (reciente && f.Random.Bool(0.4f)))
            {
                return;
            }
            pedido.EntregadoEn = entregado;
            Historial(pedido, EstadoPedido.EnCamino, EstadoPedido.Entregado, repartidor.Id, entregado);
            pedido.Estado = EstadoPedido.Entregado;
        }

        private void Rechazar(Pedido pedido, Usuario revisor, DateTime cuando)
        {
            Liberar(pedido, revisor.Id, cuando);
            pedido.RevisadoPorId = revisor.Id;
            pedido.RevisadoEn = cuando;
            pedido.MotivoRechazo = f.PickRandom(CatalogoDemo.MotivosRechazo);
            Historial(pedido, EstadoPedido.Pendiente, EstadoPedido.Rechazado, revisor.Id, cuando);
            pedido.Estado = EstadoPedido.Rechazado;
        }

        private void Expirar(Pedido pedido)
        {
            Liberar(pedido, null, pedido.ExpiraEn);
            Historial(pedido, EstadoPedido.Pendiente, EstadoPedido.Expirado, null, pedido.ExpiraEn);
            pedido.Estado = EstadoPedido.Expirado;
        }

        private void Liberar(Pedido pedido, Guid? usuarioId, DateTime cuando)
        {
            foreach (var item in pedido.Items)
            {
                var s = stock[item.ProductoId];
                var antes = s.Disponible;
                s.Disponible += item.Cantidad;
                s.Reservado -= item.Cantidad;
                s.Ultimo = Max(s.Ultimo, cuando);
                Movimiento(item.ProductoId, pedido.Id, usuarioId, TipoMovimientoInventario.Liberacion, item.Cantidad, antes,
                    s.Disponible, cuando);
                if (antes == 0)
                {
                    ResolverAgotado(s);
                }
            }
        }

        // ---- Inventario ----

        private void Reponer(Stock s, DateTime cuando, int cantidad)
        {
            var vendedor = f.PickRandom(vendedores);
            var antes = s.Disponible;
            s.Disponible += cantidad;
            s.Ultimo = cuando;
            Movimiento(s.Producto.Id, null, vendedor.Id, TipoMovimientoInventario.Reposicion, cantidad, antes, s.Disponible, cuando);
            Auditar(vendedor.Id, Entidades.Producto, s.Producto.Id, AccionAuditoria.Editar,
                new { StockDisponible = antes }, new { StockDisponible = s.Disponible }, cuando);
            if (antes == 0)
            {
                ResolverAgotado(s);
            }
        }

        // Conteo físico: el stock de dos productos resulta en 0 y ya no se reponen.
        private void Agotar(DateTime cuando)
        {
            var vendedor = vendedores[0];
            foreach (var s in stock.Values.Where(s => s.Producto.CodigoSku is "LAC-0002" or "BEB-0004"))
            {
                s.Reponible = false;
                if (s.Disponible == 0)
                {
                    continue;
                }
                var antes = s.Disponible;
                var momento = Max(s.Ultimo.AddSeconds(1), cuando);
                s.Disponible = 0;
                s.Ultimo = momento;
                Movimiento(s.Producto.Id, null, vendedor.Id, TipoMovimientoInventario.Ajuste, -antes, antes, 0, momento);
                Auditar(vendedor.Id, Entidades.Producto, s.Producto.Id, AccionAuditoria.Editar,
                    new { StockDisponible = antes }, new { StockDisponible = 0 }, momento);
                NotificarAgotado(s, momento);
            }
        }

        private void NotificarAgotado(Stock s, DateTime cuando)
        {
            s.Agotado = new Notificacion
            {
                Id = Guid.CreateVersion7(cuando), Tipo = TipoNotificacion.StockAgotado, ProductoId = s.Producto.Id, CreadoEn = cuando,
            };
            notificaciones.Add(s.Agotado);
        }

        private static void ResolverAgotado(Stock s)
        {
            if (s.Agotado is not null)
            {
                s.Agotado.Leida = true;
                s.Agotado = null;
            }
        }

        // ---- Utilidades ----

        private void Programar(DateTime cuando, Action accion) => eventos.Enqueue(accion, (cuando, secuencia++));

        // Elección ponderada con pesos relativos. (Randomizer.WeightedRandom de Bogus exige que
        // los pesos sumen 1: con pesos relativos casi siempre devuelve el primer elemento).
        private T Elegir<T>(T[] items, float[] pesos)
        {
            var total = pesos.Sum();
            var punto = f.Random.Double() * total;
            for (var i = 0; i < items.Length; i++)
            {
                punto -= pesos[i];
                if (punto < 0)
                {
                    return items[i];
                }
            }
            return items[^1];
        }

        private decimal TasaEn(DateTime utc)
        {
            var vigente = tasas[0].Tasa;
            foreach (var (cuando, tasa) in tasas)
            {
                if (cuando > utc)
                {
                    break;
                }
                vigente = tasa;
            }
            return vigente;
        }

        private void Historial(Pedido pedido, EstadoPedido? anterior, EstadoPedido nuevo, Guid? usuarioId, DateTime cuando) =>
            pedido.HistorialEstados.Add(new HistorialEstadoPedido
            {
                Id = Guid.CreateVersion7(cuando),
                PedidoId = pedido.Id,
                EstadoAnterior = anterior,
                EstadoNuevo = nuevo,
                UsuarioId = usuarioId,
                CreadoEn = cuando,
            });

        private void Movimiento(Guid productoId, Guid? pedidoId, Guid? usuarioId, TipoMovimientoInventario tipo, int cantidad,
            int antes, int despues, DateTime cuando) =>
            movimientos.Add(new MovimientoInventario
            {
                Id = Guid.CreateVersion7(cuando),
                ProductoId = productoId,
                PedidoId = pedidoId,
                UsuarioId = usuarioId,
                Tipo = tipo,
                Cantidad = cantidad,
                DisponibleAntes = antes,
                DisponibleDespues = despues,
                CreadoEn = cuando,
            });

        private void Auditar(Guid usuarioId, string entidad, Guid? entidadId, AccionAuditoria accion, object? antes, object? despues,
            DateTime cuando) =>
            auditorias.Add(new Auditoria
            {
                Id = Guid.CreateVersion7(cuando),
                UsuarioId = usuarioId,
                Entidad = entidad,
                EntidadId = entidadId,
                Accion = accion,
                DatosAntes = antes is null ? null : JsonSerializer.Serialize(antes, Json),
                DatosDespues = despues is null ? null : JsonSerializer.Serialize(despues, Json),
                CreadoEn = cuando,
            });

        private string Telefono() =>
            "+58" + f.PickRandom("412", "414", "416", "424", "426") + f.Random.ReplaceNumbers("#######");

        private string Direccion()
        {
            var via = string.Format(CultureInfo.InvariantCulture, f.PickRandom(CatalogoDemo.Vias), f.Random.Int(1, 22));
            var casa = Elegir(
                [$"casa N.º {f.Random.Int(1, 99)}-{f.Random.Int(1, 99)}", $"edificio {f.Name.LastName()}, piso {f.Random.Int(1, 8)}, apto {f.Random.Int(1, 4)}{f.PickRandom("A", "B")}", $"quinta {f.Name.FirstName()}"],
                [60f, 30f, 10f]);
            return $"{via}, {casa}. Referencia: {f.PickRandom(CatalogoDemo.Referencias)}";
        }

        private static string SinAcentos(string texto)
        {
            var sb = new StringBuilder();
            foreach (var c in texto.Normalize(NormalizationForm.FormD))
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark && char.IsLetter(c))
                {
                    sb.Append(char.ToLowerInvariant(c));
                }
            }
            return sb.ToString();
        }

        private DateTime Local(DateTime utc) => TimeZoneInfo.ConvertTimeFromUtc(utc, zona);

        private DateTime Utc(DateOnly dia, TimeOnly hora) =>
            TimeZoneInfo.ConvertTimeToUtc(dia.ToDateTime(hora, DateTimeKind.Unspecified), zona);

        private static DateTime Max(DateTime a, DateTime b) => a > b ? a : b;
    }
}
