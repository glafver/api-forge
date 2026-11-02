using backend.Data;
using Microsoft.EntityFrameworkCore;

public static class DatabaseInitializer
{
    public static void EnsureDatabaseCreated(this IApplicationBuilder app)
    {
        using var scope = app.ApplicationServices.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDBContext>();
        dbContext.Database.EnsureCreated();
    }
}
