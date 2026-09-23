# Consulte https://aka.ms/customizecontainer para aprender a personalizar su contenedor de depuración y cómo Visual Studio usa este Dockerfile para compilar sus imágenes para una depuración más rápida.
# Contexto de compilación: la raíz de la solución (docker build -f WebAPI/Dockerfile .).

# Esta fase se usa cuando se ejecuta desde VS en modo rápido (valor predeterminado para la configuración de depuración)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081


# Esta fase se usa para compilar el proyecto de servicio
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["Domain/Backend_Almacen.Domain.csproj", "Domain/"]
COPY ["Application/Backend_Almacen.Application.csproj", "Application/"]
COPY ["Infrastructure/Backend_Almacen.Infrastructure.csproj", "Infrastructure/"]
COPY ["WebAPI/Backend_Almacen.WebAPI.csproj", "WebAPI/"]
RUN dotnet restore "./WebAPI/Backend_Almacen.WebAPI.csproj"
COPY . .
WORKDIR "/src/WebAPI"
RUN dotnet build "./Backend_Almacen.WebAPI.csproj" -c $BUILD_CONFIGURATION -o /app/build

# Esta fase se usa para publicar el proyecto de servicio que se copiará en la fase final.
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./Backend_Almacen.WebAPI.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# Esta fase se usa en producción o cuando se ejecuta desde VS en modo normal (valor predeterminado cuando no se usa la configuración de depuración)
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Backend_Almacen.WebAPI.dll"]
