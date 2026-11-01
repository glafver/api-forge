using backend.ApiResponse.OperationResults;
using backend.Data;
using backend.Definition.Entities;
using backend.Definition.Service;
using backend.ModelRecord.Dto;
using backend.ModelRecord.Entities;
using backend.ModelRecord.Repository;
using backend.ModelRecord.Validators;
using Microsoft.EntityFrameworkCore;

using static backend.ModelRecord.Factory.ModelRecordFactory;
using static backend.ModelRecord.Factory.RecordFieldFactory;

namespace backend.ModelRecord.Service;

public class ModelRecordService : IModelRecordService
{
    private readonly IModelDefinitionService modelDefinitionService;
    private readonly IModelRecordRepository repository;
    private readonly ApplicationDBContext dbContext;

    public ModelRecordService(
        IModelRecordRepository recordRepository,
        IModelDefinitionService dataDefinitionService,
        ApplicationDBContext applicationDbContext)
    {
        repository = recordRepository;
        modelDefinitionService = dataDefinitionService;
        dbContext = applicationDbContext;
    }

    public async Task<OperationResult<ModelRecordResponseDto>> CreateAsync(string userId, CreateRecordFieldsDto dto, string modelName)
    {
        var model = await modelDefinitionService.GetModelByNameAsync(modelName);
        if (model is null)
        {
            return OperationResult<ModelRecordResponseDto>.Failure(new OperationError("Model not found", 404));
        }

        var accessError = await AuthorizeModelAccessAsync(userId, model);
        if (accessError is not null)
        {
            return OperationResult<ModelRecordResponseDto>.Failure(accessError);
        }

        var (isValid, error) = RecordFieldsValidators.ValidateFields(model, dto);
        if (!isValid)
        {
            return OperationResult<ModelRecordResponseDto>.Failure(new OperationError(error ?? "Invalid fields", 400));
        }

        var newModelRecord = CreateNewRecord(model.Id);
        newModelRecord.Values = CreateFieldValuesForModelDefinition(dto, model, newModelRecord.Id);
        await repository.AddAsync(newModelRecord);

        return OperationResult<ModelRecordResponseDto>.Success(ToResponse(newModelRecord));
    }

    public async Task<OperationResult<List<ModelRecordResponseDto>>> GetAllRecordsByName(string userId, string modelName)
    {
        var model = await modelDefinitionService.GetModelByNameAsync(modelName);
        if (model is null)
        {
            return OperationResult<List<ModelRecordResponseDto>>.Failure(new OperationError("Model not found", 404));
        }

        var accessError = await AuthorizeModelAccessAsync(userId, model);
        if (accessError is not null)
        {
            return OperationResult<List<ModelRecordResponseDto>>.Failure(accessError);
        }

        var records = await dbContext.Records
            .AsNoTracking()
            .Include(r => r.Values)
            .Where(r => r.ModelId == model.Id)
            .ToListAsync();

        var response = records.Select(ToResponse).ToList();
        return OperationResult<List<ModelRecordResponseDto>>.Success(response);
    }

    public async Task<OperationResult<ModelRecordResponseDto>> GetRecordByIdAsync(string userId, string modelName, Guid id)
    {
        var model = await modelDefinitionService.GetModelByNameAsync(modelName);
        if (model is null)
        {
            return OperationResult<ModelRecordResponseDto>.Failure(new OperationError("Model not found", 404));
        }

        var accessError = await AuthorizeModelAccessAsync(userId, model);
        if (accessError is not null)
        {
            return OperationResult<ModelRecordResponseDto>.Failure(accessError);
        }

        var record = await dbContext.Records
            .AsNoTracking()
            .Include(r => r.Values)
            .FirstOrDefaultAsync(r => r.Id == id && r.ModelId == model.Id);

        if (record is null)
        {
            return OperationResult<ModelRecordResponseDto>.Failure(new OperationError("Record not found", 404));
        }

        return OperationResult<ModelRecordResponseDto>.Success(ToResponse(record));
    }

    public async Task<OperationResult<ModelRecordResponseDto>> UpdateRecordAsync(string userId, string modelName, Guid id, CreateRecordFieldsDto dto)
    {
        var model = await modelDefinitionService.GetModelByNameAsync(modelName);
        if (model is null)
        {
            return OperationResult<ModelRecordResponseDto>.Failure(new OperationError("Model not found", 404));
        }

        var accessError = await AuthorizeModelAccessAsync(userId, model);
        if (accessError is not null)
        {
            return OperationResult<ModelRecordResponseDto>.Failure(accessError);
        }

        var (isValid, error) = RecordFieldsValidators.ValidateFields(model, dto);
        if (!isValid)
        {
            return OperationResult<ModelRecordResponseDto>.Failure(new OperationError(error ?? "Invalid fields", 400));
        }

        var record = await dbContext.Records
            .Include(r => r.Values)
            .FirstOrDefaultAsync(r => r.Id == id && r.ModelId == model.Id);

        if (record is null)
        {
            return OperationResult<ModelRecordResponseDto>.Failure(new OperationError("Record not found", 404));
        }

        // Replace existing values with the new set. The old values are deleted first so
        // the FieldValue rows for this record are fully refreshed.
        dbContext.FieldValues.RemoveRange(record.Values);
        record.Values = CreateFieldValuesForModelDefinition(dto, model, record.Id);

        await dbContext.SaveChangesAsync();

        return OperationResult<ModelRecordResponseDto>.Success(ToResponse(record));
    }

    public async Task<OperationResult<bool>> DeleteRecordAsync(string userId, string modelName, Guid id)
    {
        var model = await modelDefinitionService.GetModelByNameAsync(modelName);
        if (model is null)
        {
            return OperationResult<bool>.Failure(new OperationError("Model not found", 404));
        }

        var accessError = await AuthorizeModelAccessAsync(userId, model);
        if (accessError is not null)
        {
            return OperationResult<bool>.Failure(accessError);
        }

        var deleted = await dbContext.Records
            .Where(r => r.Id == id && r.ModelId == model.Id)
            .ExecuteDeleteAsync();

        if (deleted == 0)
        {
            return OperationResult<bool>.Failure(new OperationError("Record not found", 404));
        }

        return OperationResult<bool>.Success(true);
    }

    private async Task<OperationError?> AuthorizeModelAccessAsync(string userId, ModelDefinitionEntity model)
    {
        if (model.ProjectId is null)
        {
            return new OperationError("Model is not associated with a project", 404);
        }

        var isMember = await dbContext.ProjectMembers
            .AnyAsync(pm => pm.ProjectId == model.ProjectId && pm.UserId == userId);

        if (!isMember)
        {
            return new OperationError("Forbidden", 403);
        }

        return null;
    }

    private static ModelRecordResponseDto ToResponse(ModelRecordEntity record)
    {
        var fields = record.Values
            .Select(v => new RecordFieldDto(v.Name, v.Value))
            .ToList();

        return new ModelRecordResponseDto(record.Id, fields);
    }
}
