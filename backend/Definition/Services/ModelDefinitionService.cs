using backend.ApiResponse.OperationResults;
using backend.Data;
using backend.Definition.Dto;
using backend.Definition.Entities;
using backend.Definition.Factory;
using backend.Definition.Repository;
using backend.ModelRecord.Entities;
using Microsoft.EntityFrameworkCore;

namespace backend.Definition.Service;

public class ModelDefinitionService : IDefinitionService
{
    private readonly IDefinitionRepository repository;
    private readonly ApplicationDBContext dbContext;


    public ModelDefinitionService(IDefinitionRepository definitionRepository, ApplicationDBContext applicationDbContext)
    {
        repository = definitionRepository;
        dbContext = applicationDbContext;
    }

    public async Task<OperationResult<ModelDefinitionResponseDto>> CreateAsync(string userId, Guid projectId, ModelDefinitionCreateDto dto)
    {
        var accessError = await AuthorizeProjectAccessAsync(userId, projectId);
        if (accessError is not null)
        {
            return OperationResult<ModelDefinitionResponseDto>.Failure(accessError);
        }

        if (!IsValidIdentifier(dto.Name))
        {
            return OperationResult<ModelDefinitionResponseDto>.Failure(
                new OperationError("Model name can only contain letters, digits and underscores (no spaces), and must start with a letter or underscore", 400)
            );
        }

        if (IsReservedModelName(dto.Name))
        {
            return OperationResult<ModelDefinitionResponseDto>.Failure(
                new OperationError($"Model name '{dto.Name}' is reserved for built-in endpoints", 400)
            );
        }

        foreach (var field in dto.Fields)
        {
            if (!IsValidIdentifier(field.Name))
            {
                return OperationResult<ModelDefinitionResponseDto>.Failure(
                    new OperationError($"Field name '{field.Name}' can only contain letters, digits and underscores (no spaces)", 400)
                );
            }

            if (!IsSupportedFieldType(field.Type))
            {
                return OperationResult<ModelDefinitionResponseDto>.Failure(
                    new OperationError($"Field '{field.Name}' has unsupported type '{field.Type}'", 400)
                );
            }
        }

        if (dto.Fields.Select(f => f.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count() != dto.Fields.Count)
        {
            return OperationResult<ModelDefinitionResponseDto>.Failure(
                new OperationError("Field names must be unique within a model", 400)
            );
        }

        // Model names map directly to the generated endpoint route (api/projects/{projectId}/{name}),
        // so they must be unique within a project.
        var existing = await repository.FindAsync(e => e.Name == dto.Name && e.ProjectId == projectId);
        if (existing is not null)
        {
            return OperationResult<ModelDefinitionResponseDto>.Failure(
                new OperationError($"A model named '{dto.Name}' already exists", 409)
            );
        }

        var newModelDefinition = DefinitionFactory.FromModelDefinitionCreateDto(projectId, dto);
        var result = await repository.AddAsync(newModelDefinition);

        var response = DefinitionFactory.FromModelDefinitionEntity(result);
        return OperationResult<ModelDefinitionResponseDto>.Success(response);
    }

    public async Task<ModelDefinitionEntity?> GetModelByNameAsync(Guid projectId, string name)
    {
        return await repository.FindAsync(e => e.Name == name && e.ProjectId == projectId);
    }
    public async Task<OperationResult<IEnumerable<ModelDefinitionResponseDto>>> ListByProjectAsync(string userId, Guid projectId)
    {
        var accessError = await AuthorizeProjectAccessAsync(userId, projectId);
        if (accessError is not null)
        {
            return OperationResult<IEnumerable<ModelDefinitionResponseDto>>.Failure(accessError);
        }

        var models = await repository.FindAllAsync(e => e.ProjectId == projectId);
        var response = models.Select(DefinitionFactory.FromModelDefinitionEntity).ToList();
        return OperationResult<IEnumerable<ModelDefinitionResponseDto>>.Success(response);
    }

    public async Task<OperationResult<bool>> DeleteDefinitionAsync(string userId, Guid projectId, Guid definitionId)
    {
        var accessError = await AuthorizeProjectAccessAsync(userId, projectId);
        if (accessError is not null)
        {
            return OperationResult<bool>.Failure(accessError);
        }

        try
        {
            var deleted = await repository.DeleteWhereAsync(e => e.Id == definitionId && e.ProjectId == projectId);
            if (deleted == 0)
            {
                return OperationResult<bool>.Failure(new OperationError("Model not found", 404));
            }

            return OperationResult<bool>.Success(true);
        }
        catch (DbUpdateException)
        {
            return OperationResult<bool>.Failure(new OperationError("Model delete failed", 409));
        }
    }

    public async Task<OperationResult<bool>> DeleteFieldAsync(string userId, Guid projectId, Guid definitionId, Guid fieldId)
    {
        var accessError = await AuthorizeProjectAccessAsync(userId, projectId);
        if (accessError is not null)
        {
            return OperationResult<bool>.Failure(accessError);
        }

        var model = await repository.FindAsync(e => e.Id == definitionId && e.ProjectId == projectId);
        if (model is null)
        {
            return OperationResult<bool>.Failure(new OperationError("Model not found", 404));
        }

        try
        {
            // Verify the field belongs to this model before deleting anything,
            // so a field id from another model cannot wipe its values.
            var field = await dbContext.Fields
                .FirstOrDefaultAsync(f => f.Id == fieldId && f.ModelId == definitionId);

            if (field is null)
            {
                return OperationResult<bool>.Failure(new OperationError("Field not found", 404));
            }

            // Delete the values that reference this field first (FieldValue.FieldId is Restrict).
            await dbContext.FieldValues
                .Where(value => value.FieldId == fieldId)
                .ExecuteDeleteAsync();

            await dbContext.Fields
                .Where(f => f.Id == fieldId)
                .ExecuteDeleteAsync();

            return OperationResult<bool>.Success(true);
        }
        catch (DbUpdateException)
        {
            return OperationResult<bool>.Failure(new OperationError("Field delete failed", 409));
        }
    }

    public async Task<OperationResult<FieldDefinitionResponseDto>> AddFieldAsync(
        string userId,
        Guid projectId,
        Guid definitionId,
        FieldDefinitionCreateDto dto
    )
    {
        var accessError = await AuthorizeProjectAccessAsync(userId, projectId);
        if (accessError is not null)
        {
            return OperationResult<FieldDefinitionResponseDto>.Failure(accessError);
        }

        var model = await repository.FindAsync(e => e.Id == definitionId && e.ProjectId == projectId);
        if (model is null)
        {
            return OperationResult<FieldDefinitionResponseDto>.Failure(new OperationError("Model not found", 404));
        }

        if (!IsValidIdentifier(dto.Name))
        {
            return OperationResult<FieldDefinitionResponseDto>.Failure(
                new OperationError("Field name can only contain letters, digits and underscores (no spaces), and must start with a letter or underscore", 400)
            );
        }

        if (!IsSupportedFieldType(dto.Type))
        {
            return OperationResult<FieldDefinitionResponseDto>.Failure(
                new OperationError($"Field '{dto.Name}' has unsupported type '{dto.Type}'", 400)
            );
        }

        var fieldNameExists = await dbContext.Fields
            .AnyAsync(f => f.ModelId == definitionId && f.Name == dto.Name);
        if (fieldNameExists)
        {
            return OperationResult<FieldDefinitionResponseDto>.Failure(
                new OperationError($"Field '{dto.Name}' already exists on this model", 409)
            );
        }

        var field = new FieldDefinitionEntity
        {
            Id = Guid.NewGuid(),
            ModelId = definitionId,
            Name = dto.Name,
            Type = dto.Type
        };

        try
        {
            await dbContext.Fields.AddAsync(field);

            // Backfill existing records with an empty value for the new field,
            // so older records stay consistent with the updated schema.
            var recordIds = await dbContext.Records
                .Where(r => r.ModelId == definitionId)
                .Select(r => r.Id)
                .ToListAsync();

            foreach (var recordId in recordIds)
            {
                dbContext.FieldValues.Add(new FieldValueEntity
                {
                    Id = Guid.NewGuid(),
                    FieldId = field.Id,
                    RecordId = recordId,
                    Name = dto.Name,
                    Value = string.Empty
                });
            }

            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return OperationResult<FieldDefinitionResponseDto>.Failure(new OperationError("Field create failed", 409));
        }

        return OperationResult<FieldDefinitionResponseDto>.Success(
            new FieldDefinitionResponseDto(field.Id, field.Name, field.Type)
        );
    }

    private async Task<OperationError?> AuthorizeProjectAccessAsync(string userId, Guid projectId)
    {
        var isMember = await dbContext.ProjectMembers
            .AnyAsync(pm => pm.ProjectId == projectId && pm.UserId == userId);

        if (!isMember)
        {
            return new OperationError("Forbidden", 403);
        }

        return null;
    }

    private static bool IsValidIdentifier(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return false;
        if (!(char.IsAsciiLetter(name[0]) || name[0] == '_')) return false;
        return name.All(c => char.IsAsciiLetterOrDigit(c) || c == '_');
    }

    private static readonly string[] ReservedModelNames = ["definitions", "members", "invitations"];

    private static readonly string[] SupportedFieldTypes = ["string", "int", "double", "bool", "guid"];

    private static bool IsSupportedFieldType(string type)
    {
        return SupportedFieldTypes.Contains(type, StringComparer.OrdinalIgnoreCase);
    }

    private static bool IsReservedModelName(string name)
    {
        return ReservedModelNames.Contains(name, StringComparer.OrdinalIgnoreCase);
    }
}