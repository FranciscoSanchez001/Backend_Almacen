using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Application.Modelos;
using Backend_Almacen.Application.Servicios;
using Backend_Almacen.Domain.Enums;
using Backend_Almacen.WebAPI.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend_Almacen.WebAPI.Controllers
{
    // Dashboard de KPIs e informe en Excel (solo superadmin). Los dos salen del mismo cálculo
    // (ReportesService), así que el Excel coincide con lo que se ve en pantalla.
    //
    // Fechas locales de la tienda (yyyy-MM-dd), ambas inclusive:
    //   tipo=diario|semanal|mensual toma el día, la semana (lunes a domingo) o el mes de `desde`
    //   (hoy si no viene); tipo=personalizado usa desde y hasta. En /kpis, sin parámetros es el
    //   mes en curso y con desde/hasta sin tipo es personalizado.
    [ApiController]
    [Authorize(Roles = Roles.Superadmin)]
    public class ReportesController(
        ReportesService reportes,
        IGeneradorExcel excel,
        IUnitOfWork unidad,
        AuditoriaService auditoria) : ControllerBase
    {
        private const string TipoXlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        [HttpGet("kpis")]
        public async Task<ActionResult<Kpis>> Kpis(
            [FromQuery] TipoReporte? tipo,
            [FromQuery] DateOnly? desde,
            [FromQuery] DateOnly? hasta,
            CancellationToken ct)
        {
            var resultado = reportes.ResolverPeriodo(tipo, desde, hasta);
            if (resultado.Periodo is null)
            {
                return PeriodoInvalido(resultado.Error!);
            }
            return await reportes.CalcularKpisAsync(resultado.Periodo, ct);
        }

        // Cada descarga queda en la auditoría: quién, qué período y cuándo.
        [HttpGet("reportes/excel")]
        public async Task<IActionResult> Excel(
            [FromQuery] TipoReporte? tipo,
            [FromQuery] DateOnly? desde,
            [FromQuery] DateOnly? hasta,
            CancellationToken ct)
        {
            if (tipo is null)
            {
                return PeriodoInvalido("Indica el tipo de informe: diario, semanal, mensual o personalizado.");
            }
            var resultado = reportes.ResolverPeriodo(tipo, desde, hasta);
            if (resultado.Periodo is not { } periodo)
            {
                return PeriodoInvalido(resultado.Error!);
            }

            var contenido = excel.Generar(await reportes.CalcularAsync(periodo, ct));
            var archivo = NombreArchivo(periodo);

            auditoria.Registrar(User.GetUsuarioId(), Entidades.Reporte, null, AccionAuditoria.DescargarReporte, null,
                new { Tipo = periodo.Tipo, periodo.Desde, periodo.Hasta, Archivo = archivo });
            await unidad.GuardarCambiosAsync(ct);

            return File(contenido, TipoXlsx, archivo);
        }

        // informe_ventas_2026-09_mensual.xlsx, informe_ventas_2026-09-23_diario.xlsx,
        // informe_ventas_2026-09-21_semanal.xlsx (lunes de la semana),
        // informe_ventas_2026-09-01_a_2026-09-15_personalizado.xlsx
        private static string NombreArchivo(Periodo p) => p.Tipo switch
        {
            TipoReporte.Diario => $"informe_ventas_{p.Desde:yyyy-MM-dd}_diario.xlsx",
            TipoReporte.Semanal => $"informe_ventas_{p.Desde:yyyy-MM-dd}_semanal.xlsx",
            TipoReporte.Mensual => $"informe_ventas_{p.Desde:yyyy-MM}_mensual.xlsx",
            _ => $"informe_ventas_{p.Desde:yyyy-MM-dd}_a_{p.Hasta:yyyy-MM-dd}_personalizado.xlsx",
        };

        private ActionResult PeriodoInvalido(string mensaje)
        {
            ModelState.AddModelError("periodo", mensaje);
            return ValidationProblem(ModelState);
        }
    }
}
