# ============================================================================
# Backend_Almacen · Imagen Docker multi-stage de la API (ASP.NET Core 10)
# Contexto de compilación: src/backend  (docker build -f Presentation.API/Dockerfile src/backend)
#
#   base   Runtime ASP.NET Core sobre Alpine: sin SDK ni código fuente (< 120 MB)
#   build  SDK de .NET 10: restaura y publica (se descarta al terminar)
#   final  base + la publicación de la etapa build
# ============================================================================

# =========================================================
# ETAPA BASE (runtime liviano). Visual Studio la usa también en su modo de depuración rápida.
# =========================================================
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS base
# Alpine no trae la base de zonas horarias; los reportes usan America/Caracas (Reportes:ZonaHoraria).
RUN apk add --no-cache tzdata
WORKDIR /app
# Kestrel escucha en el puerto 5000 del contenedor.
ENV ASPNETCORE_HTTP_PORTS=5000
EXPOSE 5000

# =========================================================
# ETAPA DE COMPILACIÓN (.NET SDK 10)
# =========================================================
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
# Arquitectura destino que inyecta Docker BuildKit (amd64 o arm64).
ARG TARGETARCH
WORKDIR /src

# 1) Copiar solo los .csproj y restaurar. Esta capa se cachea y solo se repite si cambian
#    las dependencias. Se restaura para Linux musl (Alpine): así la publicación incluye
#    únicamente las librerías nativas de esa plataforma (p. ej. las de QuestPDF) y no las
#    de Windows, macOS y glibc.
COPY ["Core.Domain/Core.Domain.csproj", "Core.Domain/"]
COPY ["Core.Application/Core.Application.csproj", "Core.Application/"]
COPY ["Infrastructure/Infrastructure.csproj", "Infrastructure/"]
COPY ["Presentation.API/Presentation.API.csproj", "Presentation.API/"]
RUN RID="linux-musl-$( [ "$TARGETARCH" = "arm64" ] && echo arm64 || echo x64 )" \
 && dotnet restore "Presentation.API/Presentation.API.csproj" -r "$RID"

# 2) Copiar el código y publicar en una sola pasada (sin un "dotnet build" previo redundante).
#    SatelliteResourceLanguages=es descarta las traducciones de las librerías a otros idiomas.
COPY . .
RUN RID="linux-musl-$( [ "$TARGETARCH" = "arm64" ] && echo arm64 || echo x64 )" \
 && dotnet publish "Presentation.API/Presentation.API.csproj" \
      -c $BUILD_CONFIGURATION -r "$RID" --self-contained false --no-restore \
      -o /app/publish /p:UseAppHost=false /p:SatelliteResourceLanguages=es

# =========================================================
# ETAPA FINAL (producción): solo el runtime y los binarios publicados
# =========================================================
FROM base AS final
COPY --from=build /app/publish .
# Carpeta donde la API guarda las capturas de pago cuando no hay Cloudinary configurado.
# Se crea con dueño "app" porque el contenedor no corre como root.
RUN mkdir -p wwwroot/capturas && chown -R $APP_UID:$APP_UID wwwroot
USER $APP_UID
ENTRYPOINT ["dotnet", "Presentation.API.dll"]
