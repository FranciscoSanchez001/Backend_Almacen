using System.Text.Json;
using System.Text.Json.Serialization;
using Backend_Almacen.Auth;
using Backend_Almacen.Data;
using Backend_Almacen.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddDbContext<AlmacenDbContext>(options => options
    .UseNpgsql(builder.Configuration.GetConnectionString("Almacen"), AlmacenDbContext.MapEnums)
    .UseSnakeCaseNamingConvention());

// Autenticación con JWT. El personal lo obtiene en POST /auth/login; el login de clientes con
// Google emitirá el mismo tipo de token.
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwt = jwtSection.Get<JwtOptions>() ?? throw new InvalidOperationException("Falta la sección Jwt en la configuración.");
if (jwt.Key.Length < 32)
{
    throw new InvalidOperationException("Jwt:Key debe tener al menos 32 caracteres.");
}
builder.Services.Configure<JwtOptions>(jwtSection);

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
                var db = context.HttpContext.RequestServices.GetRequiredService<AlmacenDbContext>();
                var usuarioId = context.Principal?.GetUsuarioIdOrNull();
                if (usuarioId is null || !await db.Usuarios.AnyAsync(u => u.Id == usuarioId && u.Activo))
                {
                    context.Fail("Usuario inexistente o desactivado.");
                }
            },
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<AuditoriaService>();
builder.Services.AddScoped<TasaService>();
builder.Services.AddScoped<InventarioService>();
builder.Services.AddScoped<PedidosService>();

// Capturas de pago: Cloudinary si está configurado; si no, disco local (solo desarrollo).
var cloudinary = builder.Configuration.GetSection("Cloudinary").Get<CloudinaryOptions>() ?? new CloudinaryOptions();
if (cloudinary.Configurado)
{
    builder.Services.AddSingleton(cloudinary);
    builder.Services.AddSingleton<IAlmacenamientoArchivos, AlmacenamientoCloudinary>();
}
else
{
    builder.Services.AddSingleton<IAlmacenamientoArchivos, AlmacenamientoLocal>();
}

// WhatsApp: los mensajes se encolan y los envía un worker en segundo plano al servicio de Baileys.
builder.Services.AddSingleton(builder.Configuration.GetSection("Whatsapp").Get<WhatsappOptions>() ?? new WhatsappOptions());
builder.Services.AddSingleton<ColaWhatsapp>();
builder.Services.AddHttpClient(nameof(EnvioWhatsappWorker), c => c.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddHostedService<EnvioWhatsappWorker>();

// Job de expiración de pedidos pendientes.
builder.Services.AddSingleton(builder.Configuration.GetSection("Expiracion").Get<ExpiracionOptions>() ?? new ExpiracionOptions());
builder.Services.AddHostedService<ExpiracionPedidosJob>();

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
if (!cloudinary.Configurado)
{
    var capturas = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "capturas");
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

await DbSeeder.SembrarSuperadminAsync(app);

app.Run();
