using backend.ApiResponse.OperationResults;
using backend.Data;
using backend.Definition.Dto;
using backend.Definition.Entities;
using backend.Definition.Factory;
using backend.Definition.Repository;
using backend.ModelRecord.Entities;
using Microsoft.EntityFrameworkCore;

namespace backend.Definition.Service;

public class ModelDefinitionService : IModelDefinitionService, IDefinitionService
{
    private readonly IDefinitionRepository repository;
    private readonly ApplicationDBContext dbContext;


    public ModelDefinitionService(IDefinitionRepository definitionRepository, ApplicationDBContext applicationDbContext)
    {
        repository = definitionRepository;
        dbContext = applicationDbContext;
    }

    public async Task<OperationResult<ModelDefinitionResponseDto>> CreateAsync(Guid projectId, ModelDefinitionCreateDto dto)
    {
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

        if (result is null)
        {
            return OperationResult<ModelDefinitionResponseDto>.Failure(new OperationError("Category creation failed", 400));
        }

        var response = DefinitionFactory.FromModelDefinitionEntity(result);
        return OperationResult<ModelDefinitionResponseDto>.Success(response);
    }

    public async Task<ModelDefinitionEntity?> GetModelByNameAsync(Guid projectId, string name)
    {
        return await repository.FindAsync(e => e.Name == name && e.ProjectId == projectId);
    }
    public async Task<OperationResult<IEnumerable<ModelDefinitionResponseDto>>> ListByProjectAsync(Guid projectId)
    {
        var models = await repository.FindAllAsync(e => e.ProjectId == projectId);
        var response = models.Select(DefinitionFactory.FromModelDefinitionEntity).ToList();
        return OperationResult<IEnumerable<ModelDefinitionResponseDto>>.Success(response);
    }

    public async Task<OperationResult<bool>> DeleteDefinitionAsync(Guid projectId, Guid definitionId)
    {
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

    public async Task<OperationResult<bool>> DeleteFieldAsync(Guid projectId, Guid definitionId, Guid fieldId)
    {
        var model = await repository.FindAsync(e => e.Id == definitionId && e.ProjectId == projectId);
        if (model is null)
        {
            return OperationResult<bool>.Failure(new OperationError("Model not found", 404));
        }

        try
        {
            // Delete the values that reference this field first (FieldValue.FieldId is Restrict).
            await dbContext.FieldValues
                .Where(value => value.FieldId == fieldId)
                .ExecuteDeleteAsync();

            var deleted = await dbContext.Fields
                .Where(field => field.Id == fieldId && field.ModelId == definitionId)
                .ExecuteDeleteAsync();

            if (deleted == 0)
            {
                return OperationResult<bool>.Failure(new OperationError("Field not found", 404));
            }

            return OperationResult<bool>.Success(true);
        }
        catch (DbUpdateException)
        {
            return OperationResult<bool>.Failure(new OperationError("Field delete failed", 409));
        }
    }

    public async Task<OperationResult<FieldDefinitionResponseDto>> AddFieldAsync(
        Guid projectId,
        Guid definitionId,
        FieldDefinitionCreateDto dto
    )
    {
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

    private static bool IsValidIdentifier(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return false;
        if (!(char.IsAsciiLetter(name[0]) || name[0] == '_')) return false;
        return name.All(c => char.IsAsciiLetterOrDigit(c) || c == '_');
    }

    private static readonly string[] ReservedModelNames = ["definitions", "members", "invitations"];

    private static bool IsReservedModelName(string name)
    {
        return ReservedModelNames.Contains(name, StringComparer.OrdinalIgnoreCase);
    }
}