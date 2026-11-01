using backend.ApiResponse.OperationResults;
using backend.ModelRecord.Dto;

namespace backend.ModelRecord.Service;

public interface IModelRecordService
{
    Task<OperationResult<ModelRecordResponseDto>> CreateAsync(string userId, CreateRecordFieldsDto dto, string modelName);
    Task<OperationResult<List<ModelRecordResponseDto>>> GetAllRecordsByName(string userId, string modelName);
    Task<OperationResult<ModelRecordResponseDto>> GetRecordByIdAsync(string userId, string modelName, Guid id);
    Task<OperationResult<ModelRecordResponseDto>> UpdateRecordAsync(string userId, string modelName, Guid id, CreateRecordFieldsDto dto);
    Task<OperationResult<bool>> DeleteRecordAsync(string userId, string modelName, Guid id);
}
