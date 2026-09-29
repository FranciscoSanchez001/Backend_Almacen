using System.Text.Json;
using System.Text.Json.Serialization;
using Core.Application;
using Core.Application.Abstracciones;
using FluentValidation;
using Infrastructure;
using Infrastructure.Archivos;
using Infrastructure.Persistencia.Semillas;
using Presentation.API.Auth;
using Presentation.API.Filtros;
using Presentation.API.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Capas de la solución: Application (casos de uso) e Infrastructure (EF Core, repositorios,
// servicios externos y jobs).
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Autenticación con JWT. El personal lo obtiene en POST /api/auth/login y los clientes en
// POST /api/auth/google. La clave secreta nunca va en el código: en desarrollo sale de
// appsettings.Development.json y en producción de la variable de entorno Jwt__Key.
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwt = jwtSection.Get<JwtOptions>() ?? throw new InvalidOperationException("Falta la sección Jwt en la configuración.");
if (string.IsNullOrEmpty(jwt.Key) || jwt.Key.Length < 32)
{
    throw new InvalidOperationException(
        "Jwt:Key debe tener al menos 32 caracteres. En producción defínela con la variable de entorno Jwt__Key.");
}
builder.Services.Configure<JwtOptions>(jwtSection);
// Singleton: solo lee opciones inmutables y firma tokens, no guarda estado por petición.
builder.Services.AddSingleton<TokenService>();

// Validadores FluentValidation propios de la API (los de negocio se registran en AddApplication).
builder.Services.AddValidatorsFromAssemblyContaining<Program>(ServiceLifetime.Transient);

// Manejo global de errores (RFC 7807). Transient: IMiddleware se resuelve del contenedor en
// cada petición y no guarda estado entre una y otra.
builder.Services.AddTransient<ExceptionMiddleware>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = jwt.SigningKey(),
            NameClaimType = JwtRegisteredClaimNames.Name,
            RoleClaimType = "role",
        };
        options.Events = new JwtBearerEvents
        {
            // Un usuario desactivado pierde el acceso de inmediato, aunque su token no haya vencido.
            OnTokenValidated = async context =>
            {
                var usuarios = context.HttpContext.RequestServices.GetRequiredService<IUsuarioRepository>();
                var usuarioId = context.Principal?.GetUsuarioIdOrNull();
                if (usuarioId is null || !await usuarios.ExisteActivoAsync(usuarioId.Value))
                {
                    context.Fail("Usuario inexistente o desactivado.");
                }
            },
            // Sin token, o con uno inválido o vencido: 401 con Problem Details.
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.Headers.WWWAuthenticate = "Bearer";
                await ExceptionMiddleware.EscribirAsync(context.HttpContext, StatusCodes.Status401Unauthorized,
                    "No autenticado", "https://tools.ietf.org/html/rfc9110#section-15.5.2",
                    context.AuthenticateFailure is null
                        ? "Debes iniciar sesión: envía el token en el encabezado Authorization: Bearer <token>."
                        : "El token no es válido o ya venció. Inicia sesión de nuevo.");
            },
            // Token válido pero el rol no tiene permiso (p. ej. ventas intentando borrar): 403.
            OnForbidden = context => ExceptionMiddleware.EscribirAsync(context.HttpContext,
                StatusCodes.Status403Forbidden, "Acceso denegado", "https://tools.ietf.org/html/rfc9110#section-15.5.4",
                "Tu rol no tiene permiso para realizar esta operación."),
        };
    });
builder.Services.AddAuthorization();

// CORS: el frontend corre en otro origen (otro dominio o puerto), así que el navegador bloquea
// sus llamadas si la API no lo autoriza. Los orígenes permitidos se configuran en
// Cors:OrigenesPermitidos. No se usan cookies (el JWT va en el encabezado Authorization), así
// que no hace falta AllowCredentials.
const string PoliticaFrontend = "Frontend";
var origenesPermitidos = builder.Configuration.GetSection("Cors:OrigenesPermitidos").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddPolicy(PoliticaFrontend, policy => policy
    .WithOrigins(origenesPermitidos)
    .AllowAnyHeader()
    .AllowAnyMethod()
    // Para que el frontend pueda leer el nombre del archivo del informe en Excel.
    .WithExposedHeaders("Content-Disposition")));

// ValidacionFilter ejecuta FluentValidation sobre cada cuerpo/formulario antes de la acción y
// responde 400 con el detalle de los errores. Se desactiva el [Required] implícito de los tipos
// de referencia no anulables para que esas reglas (y sus mensajes) las ponga FluentValidation.
builder.Services.AddControllers(options =>
    {
        options.Filters.Add<ValidacionFilter>();
        options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
    })
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower)));
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
// CORS va antes que todo: responde el preflight (OPTIONS) sin pasar por el resto del pipeline y
// agrega sus encabezados también a las respuestas de error del ExceptionMiddleware.
app.UseCors(PoliticaFrontend);
if (origenesPermitidos.Length == 0)
{
    app.Logger.LogWarning("Cors:OrigenesPermitidos está vacío: el navegador bloqueará las llamadas del frontend.");
}

// Justo después, para capturar las excepciones de todo lo que viene detrás.
app.UseMiddleware<ExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Sirve wwwroot/capturas cuando las capturas se guardan en disco local.
if (app.Services.GetService<AlmacenamientoLocal>() is { } local)
{
    var capturas = Path.Combine(local.RaizPublica, "capturas");
    Directory.CreateDirectory(capturas);
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(capturas),
        RequestPath = "/capturas",
    });
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

await app.Services.InicializarBaseDatosAsync(app.Configuration);

// Datos de demostración (solo desarrollo y a pedido):
//   dotnet run --project WebAPI -- --SiembraDemo:Habilitada=true
if (app.Environment.IsDevelopment() && app.Configuration.GetValue<bool>("SiembraDemo:Habilitada"))
{
    await app.Services.SembrarDatosDemoAsync(app.Configuration);
}

app.Run();
