using backend.Definition.Entities;

namespace backend.Definition.Service;

public interface IModelDefinitionService
{
    Task<ModelDefinitionEntity?> GetModelByNameAsync(Guid projectId, string name);
}
