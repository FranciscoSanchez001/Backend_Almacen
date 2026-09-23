namespace Backend_Almacen.Application.Comun
{
    public record Pagina<T>(IReadOnlyList<T> Items, int Total, int NumeroPagina, int Tamano)
    {
        public const int TamanoMaximo = 100;

        public static (int Pagina, int Tamano) Normalizar(int pagina, int tamano) =>
            (Math.Max(pagina, 1), Math.Clamp(tamano, 1, TamanoMaximo));

        public Pagina<U> Convertir<U>(Func<T, U> f) => new(Items.Select(f).ToList(), Total, NumeroPagina, Tamano);
    }
}
