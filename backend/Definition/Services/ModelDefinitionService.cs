using backend.ApiResponse.OperationResults;
using backend.Data;
using backend.Definition.Dto;
using backend.Definition.Entities;
using backend.Definition.Factory;
using backend.Definition.Repository;
using Microsoft.EntityFrameworkCore;

namespace backend.Definition.Service;

public class ModelDefinitionService : IModelDefinitionService
{
    private readonly IDefinitionRepository repository;
    private readonly ApplicationDBContext dbContext;


    public ModelDefinitionService(IDefinitionRepository definitionRepository, ApplicationDBContext applicationDbContext)
    {
        repository = definitionRepository;
        dbContext = applicationDbContext;
    }

    [Obsolete("Use CreateAsync(Guid projectId, ModelDefinitionCreateDto dto) instead.")]
    public Task<OperationResult<ModelDefinitionResponseDto>> CreateAsync(ModelDefinitionCreateDto dto)
    {
        var result = OperationResult<ModelDefinitionResponseDto>.Failure(
            new OperationError("ProjectId is required", 400)
        );
        return Task.FromResult(result);
    }

    public async Task<OperationResult<ModelDefinitionResponseDto>> CreateAsync(Guid projectId, ModelDefinitionCreateDto dto)
    {
        // Model names map directly to the generated endpoint route (api/{name}),
        // so they must be unique across the whole system.
        var existing = await repository.FindAsync(e => e.Name == dto.Name);
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

    public async Task<OperationResult<ModelDefinitionResponseDto>> FindByNameAsync(string name)
    {
        var model = await repository.FindAsync(e => e.Name == name);

        if (model is null)
        {
            return OperationResult<ModelDefinitionResponseDto>.Failure(new OperationError("Model not found", 404));
        }
        else
        {
            var response = DefinitionFactory.FromModelDefinitionEntity(model);
            return OperationResult<ModelDefinitionResponseDto>.Success(response);
        }
    }

    public async Task<ModelDefinitionEntity?> GetModelByNameAsync(string name)
    {
        return await repository.FindAsync(e => e.Name == name);
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
}