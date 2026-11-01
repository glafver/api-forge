# Base ASP.NET runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0-noble AS base
WORKDIR /app
EXPOSE 8080

# Build .NET app
FROM mcr.microsoft.com/dotnet/sdk:9.0-noble AS build
WORKDIR /src
COPY ["backend/backend.csproj", "backend/"]
RUN dotnet restore "backend/backend.csproj"
COPY . .
RUN dotnet publish "backend/backend.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Build frontend React app
FROM node:20 AS frontend-build
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build


FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
COPY --from=frontend-build /src/frontend/dist ./wwwroot/


ENTRYPOINT ["dotnet", "backend.dll"]
