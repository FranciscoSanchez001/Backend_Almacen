using System.Text.Json;
using System.Text.Json.Serialization;
using Backend_Almacen.Application;
using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Infrastructure;
using Backend_Almacen.Infrastructure.Archivos;
using Backend_Almacen.Infrastructure.Persistencia.Semillas;
using Backend_Almacen.WebAPI.Auth;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Capas de la solución: Application (casos de uso) e Infrastructure (EF Core, repositorios,
// servicios externos y jobs).
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Autenticación con JWT. El personal lo obtiene en POST /auth/login y los clientes en
// POST /auth/google.
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwt = jwtSection.Get<JwtOptions>() ?? throw new InvalidOperationException("Falta la sección Jwt en la configuración.");
if (jwt.Key.Length < 32)
{
    throw new InvalidOperationException("Jwt:Key debe tener al menos 32 caracteres.");
}
builder.Services.Configure<JwtOptions>(jwtSection);
builder.Services.AddScoped<TokenService>();

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
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower)));
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
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

app.Run();
