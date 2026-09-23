namespace Backend_Almacen.Application.Abstracciones
{
    // Unidad de trabajo: todos los repositorios de una petición comparten la misma sesión con la
    // base de datos, así que un solo GuardarCambiosAsync persiste lo que cada uno agregó.
    public interface IUnitOfWork
    {
        Task<ITransaccion> IniciarTransaccionAsync(CancellationToken ct = default);
        Task GuardarCambiosAsync(CancellationToken ct = default);

        bool EnTransaccion { get; }

        // Descarta las entidades cargadas (p. ej. después de un rollback).
        void LimpiarSeguimiento();
    }

    public interface ITransaccion : IAsyncDisposable
    {
        Task ConfirmarAsync(CancellationToken ct = default);
        Task RevertirAsync(CancellationToken ct = default);
    }
}
