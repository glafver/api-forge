using backend.ApplicationUser.Services;
using backend.Projects.Services;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;

using backend.Definition.Repository;
using backend.Definition.Service;
using backend.ModelRecord.Repository;
using backend.ModelRecord.Service;

var builder = WebApplication.CreateBuilder(args);

//-------------- App Configs -------------------
builder.Services.ConfigureConnectionStringForEnv(builder.Configuration, builder.Environment);


// Register Services
builder.Services.AddScoped<IDefinitionService, ModelDefinitionService>();
builder.Services.AddScoped<IModelRecordService, ModelRecordService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IProjectService, ProjectService>();



// Register Repositories
builder.Services.AddScoped<IDefinitionRepository, DefinitionRepository>();
builder.Services.AddScoped<IModelRecordRepository, ModelRecordRepository>();

builder.Services.AddSwaggerGen();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers();
builder.Services.AddAuthorization();
builder.Services.AddAuthentication();

// Configure Identity and JWT Authentication
builder.Services.AddIdentityAndJwt(builder.Configuration);


var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "ApiForge API v1"));
}

app.EnsureDatabaseCreated();

// Seed Roles
using (var scope = app.Services.CreateScope())
{
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    string[] roles = ["User"];
    foreach (var role in roles)
    {
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole(role));
    }
}

// Seed the read-only demo account and its demo project.
await DemoDataSeeder.SeedAsync(app.Services);

app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // Never cache the SPA entry point so new builds are picked up immediately.
        if (ctx.File.Name.Equals("index.html", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Context.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
        }
    }
});
app.UseRouting();
app.UseAuthentication();

// The demo account is read-only: reject any mutation (except login/logout).
app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true
        && context.Request.Path.StartsWithSegments("/api")
        && context.Request.Method is "POST" or "PUT" or "PATCH" or "DELETE"
        && !context.Request.Path.StartsWithSegments("/api/user/login")
        && !context.Request.Path.StartsWithSegments("/api/user/logout"))
    {
        var email = context.User.FindFirstValue(ClaimTypes.Email)
            ?? context.User.FindFirstValue("email");
        if (string.Equals(email, DemoDataSeeder.Email, StringComparison.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { message = "The demo account is read-only." });
            return;
        }
    }

    await next();
});

app.UseAuthorization();
app.MapControllers();
app.MapFallback((context) =>
{
    context.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
    var indexPath = Path.Combine(app.Environment.WebRootPath ?? app.Environment.ContentRootPath, "index.html");
    return context.Response.SendFileAsync(indexPath);
});
app.Run();