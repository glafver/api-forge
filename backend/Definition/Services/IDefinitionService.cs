using backend.ApiResponse.OperationResults;
using backend.Definition.Dto;

namespace backend.Definition.Service;

public interface IDefinitionService
{
    Task<OperationResult<ModelDefinitionResponseDto>> CreateAsync(Guid projectId, ModelDefinitionCreateDto dto);
    Task<OperationResult<IEnumerable<ModelDefinitionResponseDto>>> ListByProjectAsync(Guid projectId);
    Task<OperationResult<bool>> DeleteDefinitionAsync(Guid projectId, Guid definitionId);
    Task<OperationResult<bool>> DeleteFieldAsync(Guid projectId, Guid definitionId, Guid fieldId);
    Task<OperationResult<FieldDefinitionResponseDto>> AddFieldAsync(Guid projectId, Guid definitionId, FieldDefinitionCreateDto dto);
}
