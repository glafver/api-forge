using backend.ApiResponse.OperationResults;
using backend.ModelRecord.Dto;

namespace backend.ModelRecord.Service;

public interface IModelRecordService
{
    Task<OperationResult<ModelRecordResponseDto>> CreateAsync(string userId, Guid projectId, CreateRecordFieldsDto dto, string modelName);
    Task<OperationResult<PagedRecordsResponseDto>> QueryRecordsAsync(
        string userId,
        Guid projectId,
        string modelName,
        int page,
        int pageSize,
        string? sortBy,
        string? sortOrder,
        IReadOnlyDictionary<string, string> filters);
    Task<OperationResult<ModelRecordResponseDto>> GetRecordByIdAsync(string userId, Guid projectId, string modelName, Guid id);
    Task<OperationResult<ModelRecordResponseDto>> UpdateRecordAsync(string userId, Guid projectId, string modelName, Guid id, CreateRecordFieldsDto dto);
    Task<OperationResult<bool>> DeleteRecordAsync(string userId, Guid projectId, string modelName, Guid id);
    Task<OperationResult<int>> DeleteAllRecordsAsync(string userId, Guid projectId, string modelName);
}
