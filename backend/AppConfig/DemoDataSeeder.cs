using backend.ApplicationUser.Entities;
using backend.Data;
using backend.Definition.Entities;
using backend.ModelRecord.Entities;
using backend.Projects.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

public static class DemoDataSeeder
{
    public const string Email = "demo@apiforge.dev";
    public const string Username = "demo";
    public const string Password = "demo1234";

    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDBContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        var demoUser = await userManager.FindByEmailAsync(Email);
        if (demoUser is null)
        {
            demoUser = new AppUser
            {
                UserName = Username,
                Email = Email,
                EmailConfirmed = true,
                CreatedAt = DateTime.UtcNow
            };

            var created = await userManager.CreateAsync(demoUser, Password);
            if (!created.Succeeded)
            {
                return;
            }

            await userManager.AddToRoleAsync(demoUser, "User");
        }

        if (await db.Projects.AnyAsync(p => p.OwnerId == demoUser.Id))
        {
            return;
        }

        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Demo Store",
            OwnerId = demoUser.Id,
            CreatedAt = DateTime.UtcNow
        };
        project.Members.Add(new ProjectMember
        {
            ProjectId = project.Id,
            UserId = demoUser.Id,
            Role = ProjectRole.Owner,
            AddedAt = DateTime.UtcNow
        });
        db.Projects.Add(project);

        var model = new ModelDefinitionEntity
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            Name = "products"
        };

        var nameField = new FieldDefinitionEntity { Id = Guid.NewGuid(), ModelId = model.Id, Name = "name", Type = "string" };
        var priceField = new FieldDefinitionEntity { Id = Guid.NewGuid(), ModelId = model.Id, Name = "price", Type = "double" };
        var stockField = new FieldDefinitionEntity { Id = Guid.NewGuid(), ModelId = model.Id, Name = "in_stock", Type = "int" };
        model.Fields = new List<FieldDefinitionEntity> { nameField, priceField, stockField };
        db.Models.Add(model);

        var products = new (string Name, double Price, int Stock)[]
        {
            ("Mechanical Keyboard", 89.99, 12),
            ("Wireless Mouse", 34.50, 40),
            ("4K Monitor", 329.00, 7),
            ("USB-C Hub", 45.99, 25),
            ("Laptop Stand", 28.00, 15),
            ("Webcam 1080p", 59.99, 9),
        };

        foreach (var p in products)
        {
            var record = new ModelRecordEntity
            {
                Id = Guid.NewGuid(),
                ModelId = model.Id
            };
            record.Values = new List<FieldValueEntity>
            {
                new() { Id = Guid.NewGuid(), FieldId = nameField.Id, RecordId = record.Id, Name = "name", Value = p.Name },
                new() { Id = Guid.NewGuid(), FieldId = priceField.Id, RecordId = record.Id, Name = "price", Value = p.Price.ToString(System.Globalization.CultureInfo.InvariantCulture) },
                new() { Id = Guid.NewGuid(), FieldId = stockField.Id, RecordId = record.Id, Name = "in_stock", Value = p.Stock.ToString() },
            };
            db.Records.Add(record);
        }

        await db.SaveChangesAsync();
    }
}
