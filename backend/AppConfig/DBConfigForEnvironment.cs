using backend.Data;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;

public static class DBConfigForEnvironment
{
    public static IServiceCollection ConfigureConnectionStringForEnv(this IServiceCollection services,
        IConfiguration config,
        IWebHostEnvironment env)
    {
        var isRunningInDocker = config.GetValue<bool>("RUNNING_IN_DOCKER");
        if (env.IsDevelopment() && isRunningInDocker is false)
        {
            var envPath = Path.Combine(
                env.ContentRootPath,
                "..",
                ".env"
            );
            Env.Load(envPath);

            string db_name = Environment.GetEnvironmentVariable("DB_NAME") ?? "";
            string id = Environment.GetEnvironmentVariable("DB_ID") ?? "";
            string db_password = Environment.GetEnvironmentVariable("DB_PASSWORD") ?? "";
            string db_server = "localhost";



            var connectionString = $"Host={db_server};Port=5432;Database={db_name};Username={id};Password={db_password}";
            services.AddDbContext<ApplicationDBContext>(options => options.UseNpgsql(connectionString));
            return services;
        }

        services.AddDbContext<ApplicationDBContext>(options => options.UseNpgsql(config.GetConnectionString("DefaultConnection")));
        return services;
    }
}