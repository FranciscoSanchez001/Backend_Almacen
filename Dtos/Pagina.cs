using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Dtos
{
    public record Pagina<T>(IReadOnlyList<T> Items, int Total, int NumeroPagina, int Tamano)
    {
        public const int TamanoMaximo = 100;

        // La consulta ya debe venir ordenada.
        public static async Task<Pagina<T>> CrearAsync(IQueryable<T> query, int pagina, int tamano)
        {
            pagina = Math.Max(pagina, 1);
            tamano = Math.Clamp(tamano, 1, TamanoMaximo);
            var total = await query.CountAsync();
            var items = await query.Skip((pagina - 1) * tamano).Take(tamano).ToListAsync();
            return new Pagina<T>(items, total, pagina, tamano);
        }

        public Pagina<T> Map(Func<T, T> f) => this with { Items = Items.Select(f).ToList() };

        public Pagina<U> Convertir<U>(Func<T, U> f) => new(Items.Select(f).ToList(), Total, NumeroPagina, Tamano);
    }
}
