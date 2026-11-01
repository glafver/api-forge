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
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

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

    public async Task<OperationResult<PagedRecordsResponseDto>> QueryRecordsAsync(
        string userId,
        string modelName,
        int page,
        int pageSize,
        string? sortBy,
        string? sortOrder,
        IReadOnlyDictionary<string, string> filters)
    {
        var model = await modelDefinitionService.GetModelByNameAsync(modelName);
        if (model is null)
        {
            return Failure<PagedRecordsResponseDto>("Model not found", 404);
        }

        var accessError = await AuthorizeModelAccessAsync(userId, model);
        if (accessError is not null)
        {
            return Failure<PagedRecordsResponseDto>(accessError);
        }

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        if (!string.IsNullOrWhiteSpace(sortBy) && !model.Fields.Any(f => f.Name == sortBy))
        {
            return Failure<PagedRecordsResponseDto>($"Unknown sort field '{sortBy}'", 400);
        }

        if (!string.IsNullOrWhiteSpace(sortOrder) && sortOrder is not ("asc" or "desc"))
        {
            return Failure<PagedRecordsResponseDto>("Sort order must be 'asc' or 'desc'", 400);
        }

        foreach (var filterName in filters.Keys)
        {
            if (!model.Fields.Any(f => f.Name == filterName))
            {
                return Failure<PagedRecordsResponseDto>($"Unknown filter field '{filterName}'", 400);
            }
        }

        var records = await dbContext.Records
            .AsNoTracking()
            .Include(r => r.Values)
            .Where(r => r.ModelId == model.Id)
            .ToListAsync();

        var items = records.Select(ToResponse).ToList();

        foreach (var (field, value) in filters)
        {
            items = items
                .Where(record => record.Fields.Any(f => f.Name == field && f.Value == value))
                .ToList();
        }

        if (!string.IsNullOrWhiteSpace(sortBy))
        {
            var fieldType = model.Fields.First(f => f.Name == sortBy).Type.ToLower();
            var descending = string.Equals(sortOrder, "desc", StringComparison.OrdinalIgnoreCase);
            items.Sort((x, y) =>
            {
                var comparison = CompareFieldValues(x, y, sortBy, fieldType);
                return descending ? -comparison : comparison;
            });
        }

        var totalCount = items.Count;
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        var pageItems = items.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return OperationResult<PagedRecordsResponseDto>.Success(
            new PagedRecordsResponseDto(page, pageSize, totalCount, totalPages, pageItems));
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

    private static OperationResult<T> Failure<T>(string message, int status)
    {
        return OperationResult<T>.Failure(new OperationError(message, status));
    }

    private static OperationResult<T> Failure<T>(OperationError error)
    {
        return OperationResult<T>.Failure(error);
    }

    private static string? GetFieldValue(ModelRecordResponseDto record, string fieldName)
    {
        return record.Fields.FirstOrDefault(f => f.Name == fieldName)?.Value;
    }

    private static int CompareFieldValues(ModelRecordResponseDto x, ModelRecordResponseDto y, string fieldName, string type)
    {
        var vx = GetFieldValue(x, fieldName);
        var vy = GetFieldValue(y, fieldName);

        if (vx is null && vy is null) return 0;
        if (vx is null) return -1;
        if (vy is null) return 1;

        return type switch
        {
            "int" => long.TryParse(vx, out var ix) && long.TryParse(vy, out var iy)
                ? ix.CompareTo(iy)
                : string.Compare(vx, vy, StringComparison.OrdinalIgnoreCase),
            "double" => double.TryParse(vx, out var dx) && double.TryParse(vy, out var dy)
                ? dx.CompareTo(dy)
                : string.Compare(vx, vy, StringComparison.OrdinalIgnoreCase),
            "bool" => bool.TryParse(vx, out var bx) && bool.TryParse(vy, out var by)
                ? bx.CompareTo(by)
                : string.Compare(vx, vy, StringComparison.OrdinalIgnoreCase),
            _ => string.Compare(vx, vy, StringComparison.OrdinalIgnoreCase),
        };
    }

    private static ModelRecordResponseDto ToResponse(ModelRecordEntity record)
    {
        var fields = record.Values
            .Select(v => new RecordFieldDto(v.Name, v.Value))
            .ToList();

        return new ModelRecordResponseDto(record.Id, fields);
    }
}
