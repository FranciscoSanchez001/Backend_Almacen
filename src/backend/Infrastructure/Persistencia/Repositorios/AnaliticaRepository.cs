using Core.Application.Abstracciones;
using Core.Application.Modelos;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Core.Domain.Reglas;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistencia.Repositorios
{
    public class AnaliticaRepository(ApplicationDbContext db) : IAnaliticaRepository
    {
        public void Agregar(IEnumerable<EventoAnalitica> eventos) => db.EventosAnalitica.AddRange(eventos);

        public Task<int> ContarSesionesAsync(DateTime desdeUtc, DateTime hastaUtc, CancellationToken ct = default) =>
            EnRango(desdeUtc, hastaUtc).Select(e => e.SesionId).Distinct().CountAsync(ct);

        public Task<List<ConteoEvento>> ContarPorTipoAsync(DateTime desdeUtc, DateTime hastaUtc,
            CancellationToken ct = default) =>
            EnRango(desdeUtc, hastaUtc)
                .GroupBy(e => e.Tipo)
                .Select(g => new ConteoEvento(g.Key, g.Count(), g.Select(e => e.SesionId).Distinct().Count()))
                .ToListAsync(ct);

        public async Task<List<BusquedaFrecuente>> ListarBusquedasAsync(DateTime desdeUtc, DateTime hastaUtc,
            bool soloSinResultados, int limite, CancellationToken ct = default)
        {
            var busquedas = DelTipo(desdeUtc, hastaUtc, TipoEventoAnalitica.Busqueda).Where(e => e.Texto != null);
            if (soloSinResultados)
            {
                busquedas = busquedas.Where(e => e.Cantidad == 0);
            }

            var top = await busquedas
                .GroupBy(e => e.Texto!)
                .Select(g => new { Texto = g.Key, Veces = g.Count(), Sesiones = g.Select(e => e.SesionId).Distinct().Count() })
                .OrderByDescending(x => x.Veces).ThenByDescending(x => x.Sesiones).ThenBy(x => x.Texto)
                .Take(limite)
                .ToListAsync(ct);

            // Resultados de la búsqueda más reciente de cada texto (el catálogo cambia con el tiempo).
            var textos = top.Select(t => t.Texto).ToList();
            var resultados = await DelTipo(desdeUtc, hastaUtc, TipoEventoAnalitica.Busqueda)
                .Where(e => textos.Contains(e.Texto!))
                .GroupBy(e => e.Texto!)
                .Select(g => new
                {
                    Texto = g.Key,
                    Resultados = g.OrderByDescending(e => e.CreatedAt).Select(e => e.Cantidad).First(),
                })
                .ToDictionaryAsync(x => x.Texto, x => x.Resultados ?? 0, ct);

            return top.Select(t => new BusquedaFrecuente(t.Texto, t.Veces, t.Sesiones, resultados.GetValueOrDefault(t.Texto)))
                .ToList();
        }

        public async Task<List<ProductoAgregado>> ListarProductosAgregadosAsync(DateTime desdeUtc, DateTime hastaUtc,
            int limite, CancellationToken ct = default)
        {
            var agregados = await DelTipo(desdeUtc, hastaUtc, TipoEventoAnalitica.AgregarCarrito)
                .Where(e => e.ProductoId != null)
                .GroupBy(e => e.ProductoId!.Value)
                .Select(g => new
                {
                    ProductoId = g.Key,
                    Unidades = g.Sum(e => e.Cantidad ?? 1),
                    Sesiones = g.Select(e => e.SesionId).Distinct().Count(),
                })
                .OrderByDescending(x => x.Unidades).ThenByDescending(x => x.Sesiones).ThenBy(x => x.ProductoId)
                .Take(limite)
                .ToListAsync(ct);

            var ids = agregados.Select(a => a.ProductoId).ToList();
            var nombres = await db.Productos.AsNoTracking()
                .Where(p => ids.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.Nombre, ct);
            var vendidas = await db.PedidoItems.AsNoTracking()
                .Where(i => ids.Contains(i.ProductoId)
                    && i.Pedido.CreatedAt >= desdeUtc && i.Pedido.CreatedAt < hastaUtc
                    && TransicionesPedido.CuentanComoVenta.Contains(i.Pedido.Estado))
                .GroupBy(i => i.ProductoId)
                .Select(g => new { ProductoId = g.Key, Unidades = g.Sum(i => i.Cantidad) })
                .ToDictionaryAsync(x => x.ProductoId, x => x.Unidades, ct);

            // Un id que no es de ningún producto (llegó mal del navegador) no se muestra.
            return agregados
                .Where(a => nombres.ContainsKey(a.ProductoId))
                .Select(a => new ProductoAgregado(a.ProductoId, nombres[a.ProductoId], a.Unidades, a.Sesiones,
                    vendidas.GetValueOrDefault(a.ProductoId)))
                .ToList();
        }

        public async Task<List<CategoriaVisitada>> ListarCategoriasAsync(DateTime desdeUtc, DateTime hastaUtc, int limite,
            CancellationToken ct = default)
        {
            var clics = await DelTipo(desdeUtc, hastaUtc, TipoEventoAnalitica.FiltroCategoria)
                .Where(e => e.CategoriaId != null)
                .GroupBy(e => e.CategoriaId!.Value)
                .Select(g => new { CategoriaId = g.Key, Clics = g.Count(), Sesiones = g.Select(e => e.SesionId).Distinct().Count() })
                .OrderByDescending(x => x.Clics).ThenBy(x => x.CategoriaId)
                .Take(limite)
                .ToListAsync(ct);

            var ids = clics.Select(c => c.CategoriaId).ToList();
            var nombres = await db.Categorias.AsNoTracking()
                .Where(c => ids.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => c.Nombre, ct);

            return clics
                .Where(c => nombres.ContainsKey(c.CategoriaId))
                .Select(c => new CategoriaVisitada(c.CategoriaId, nombres[c.CategoriaId], c.Clics, c.Sesiones))
                .ToList();
        }

        public async Task<List<UsoCupon>> ListarCuponesAsync(DateTime desdeUtc, DateTime hastaUtc,
            CancellationToken ct = default) =>
            (await EnRango(desdeUtc, hastaUtc)
                .Where(e => (e.Tipo == TipoEventoAnalitica.CuponAplicado || e.Tipo == TipoEventoAnalitica.CuponRechazado)
                    && e.Texto != null)
                .GroupBy(e => e.Texto!)
                .Select(g => new
                {
                    Codigo = g.Key,
                    Aplicados = g.Count(e => e.Tipo == TipoEventoAnalitica.CuponAplicado),
                    Rechazados = g.Count(e => e.Tipo == TipoEventoAnalitica.CuponRechazado),
                })
                .OrderByDescending(c => c.Aplicados + c.Rechazados).ThenBy(c => c.Codigo)
                .ToListAsync(ct))
            .Select(c => new UsoCupon(c.Codigo, c.Aplicados, c.Rechazados))
            .ToList();

        public Task<List<ActividadDia>> ActividadPorDiaAsync(DateTime desdeUtc, DateTime hastaUtc, string zonaHoraria,
            CancellationToken ct = default) =>
            db.Database.SqlQuery<ActividadDia>($"""
                SELECT (creado_en AT TIME ZONE {zonaHoraria})::date AS "Dia",
                       count(DISTINCT sesion_id)::int AS "Visitas",
                       (count(*) FILTER (WHERE tipo = 'busqueda'))::int AS "Busquedas",
                       (count(*) FILTER (WHERE tipo = 'pedido_confirmado'))::int AS "Pedidos"
                  FROM eventos_analitica
                 WHERE creado_en >= {desdeUtc} AND creado_en < {hastaUtc}
                 GROUP BY 1
                """).ToListAsync(ct);

        public Task<int> EliminarAnterioresAsync(DateTime limiteUtc, CancellationToken ct = default) =>
            db.EventosAnalitica.Where(e => e.CreatedAt < limiteUtc).ExecuteDeleteAsync(ct);

        private IQueryable<EventoAnalitica> EnRango(DateTime desdeUtc, DateTime hastaUtc) =>
            db.EventosAnalitica.AsNoTracking().Where(e => e.CreatedAt >= desdeUtc && e.CreatedAt < hastaUtc);

        private IQueryable<EventoAnalitica> DelTipo(DateTime desdeUtc, DateTime hastaUtc, TipoEventoAnalitica tipo) =>
            EnRango(desdeUtc, hastaUtc).Where(e => e.Tipo == tipo);
    }
}
