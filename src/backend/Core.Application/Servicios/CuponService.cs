using Core.Application.Abstracciones;
using Core.Application.Comun;
using Core.Application.Dtos;
using Core.Application.Excepciones;
using Core.Domain.Entidades;
using Core.Domain.Enums;

namespace Core.Application.Servicios
{
    // Alta y edición de cupones (superadmin). Cada cambio queda en la auditoría con el antes y el
    // después. Los cupones no se borran (los pedidos los referencian): se desactivan.
    // Errores: KeyNotFoundException (404), ConflictoException (409).
    public class CuponService(
        ICuponRepository cupones,
        IUnitOfWork unidad,
        AuditoriaService auditoria)
    {
        public async Task<Guid> CrearAsync(CrearCuponRequest req, Guid usuarioId, CancellationToken ct = default)
        {
            var codigo = Cupon.NormalizarCodigo(req.Codigo);
            if (await cupones.CodigoEnUsoAsync(codigo, ct))
            {
                throw new ConflictoException($"Ya existe un cupón con el código {codigo}.");
            }

            var cupon = new Cupon { Id = Guid.CreateVersion7(), Codigo = codigo, CreadoPorId = usuarioId };
            Copiar(req, cupon);

            cupones.Agregar(cupon);
            auditoria.Registrar(usuarioId, Entidades.Cupon, cupon.Id, AccionAuditoria.Crear, null, CuponAuditoria.De(cupon));
            await unidad.GuardarCambiosAsync(ct);
            return cupon.Id;
        }

        public async Task ActualizarAsync(Guid id, ActualizarCuponRequest req, Guid usuarioId, CancellationToken ct = default)
        {
            var cupon = await cupones.ObtenerParaEditarAsync(id, ct)
                ?? throw new KeyNotFoundException("El cupón no existe.");
            if (req.UsosMaximos is int maximo && maximo < cupon.UsosActuales)
            {
                throw new ConflictoException(
                    $"El cupón ya tiene {cupon.UsosActuales} usos; el límite no puede ser menor que eso.");
            }

            var antes = CuponAuditoria.De(cupon);
            Copiar(req, cupon);
            var despues = CuponAuditoria.De(cupon);
            if (despues != antes)
            {
                cupon.ActualizadoEn = DateTime.UtcNow;
                auditoria.Registrar(usuarioId, Entidades.Cupon, id, AccionAuditoria.Editar, antes, despues);
                await unidad.GuardarCambiosAsync(ct);
            }
        }

        private static void Copiar(IDatosCupon datos, Cupon cupon)
        {
            cupon.Descripcion = string.IsNullOrWhiteSpace(datos.Descripcion) ? null : datos.Descripcion.Trim();
            cupon.Tipo = datos.Tipo;
            cupon.Valor = Math.Round(datos.Valor, 2, MidpointRounding.AwayFromZero);
            cupon.CompraMinimaUsd = datos.CompraMinimaUsd is decimal minimo && minimo > 0
                ? Math.Round(minimo, 2, MidpointRounding.AwayFromZero)
                : null;
            cupon.ValidoDesde = FechasUtc.AUtc(datos.ValidoDesde);
            cupon.ValidoHasta = FechasUtc.AUtc(datos.ValidoHasta);
            cupon.UsosMaximos = datos.UsosMaximos;
            cupon.Activo = datos.Activo;
        }
    }
}
