using backend.Data;
using backend.Definition.Entities;
using backend.Repository;

namespace backend.Definition.Repository;

public class DefinitionRepository : Repository<ModelDefinitionEntity>, IDefinitionRepository
{
    public DefinitionRepository(ApplicationDBContext dbContext) : base(dbContext)
    {
    }
}