using backend.ApplicationUser.Services;
using backend.Projects.Services;
using Microsoft.AspNetCore.Identity;

using backend.Definition.Repository;
using backend.Definition.Service;
using backend.ModelRecord.Repository;
using backend.ModelRecord.Service;

var builder = WebApplication.CreateBuilder(args);

//-------------- App Configs -------------------
builder.Services.ConfigureConnectionStringForEnv(builder.Configuration, builder.Environment);


// Register Services
builder.Services.AddScoped<IModelDefinitionService, ModelDefinitionService>();
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

app.ApplyMigrationsOnRun();

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
app.UseAuthorization();
app.MapControllers();
app.MapFallback((context) =>
{
    context.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
    var indexPath = Path.Combine(app.Environment.WebRootPath ?? app.Environment.ContentRootPath, "index.html");
    return context.Response.SendFileAsync(indexPath);
});
app.Run();