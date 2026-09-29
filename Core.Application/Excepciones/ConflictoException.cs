namespace Core.Application.Excepciones
{
    // La operación choca con el estado actual de los datos (SKU repetido, stock que cambió...).
    // ExceptionMiddleware la traduce a 409 Conflict.
    public class ConflictoException(string mensaje) : Exception(mensaje);
}
