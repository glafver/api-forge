using backend.ApiResponse.OperationResults;
using backend.Definition.Dto;
using backend.Definition.Entities;

namespace backend.Definition.Service;

public interface IDefinitionService
{
    Task<OperationResult<ModelDefinitionResponseDto>> CreateAsync(string userId, Guid projectId, ModelDefinitionCreateDto dto);
    Task<OperationResult<IEnumerable<ModelDefinitionResponseDto>>> ListByProjectAsync(string userId, Guid projectId);
    Task<OperationResult<bool>> DeleteDefinitionAsync(string userId, Guid projectId, Guid definitionId);
    Task<OperationResult<bool>> DeleteFieldAsync(string userId, Guid projectId, Guid definitionId, Guid fieldId);
    Task<OperationResult<FieldDefinitionResponseDto>> AddFieldAsync(string userId, Guid projectId, Guid definitionId, FieldDefinitionCreateDto dto);
    Task<ModelDefinitionEntity?> GetModelByNameAsync(Guid projectId, string name);
}
