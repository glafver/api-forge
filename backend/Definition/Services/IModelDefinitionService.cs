using backend.Definition.Entities;

namespace backend.Definition.Service;

public interface IModelDefinitionService
{
    Task<ModelDefinitionEntity?> GetModelByNameAsync(string name);
}
