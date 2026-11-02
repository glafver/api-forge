using backend.Definition.Dto;
using backend.Definition.Entities;

namespace backend.Definition.Factory;

internal static class DefinitionFactory
{
    public static ModelDefinitionEntity FromModelDefinitionCreateDto(Guid projectId, ModelDefinitionCreateDto dto)
    {
        Guid modelId = Guid.NewGuid();
        List<FieldDefinitionEntity> NewFields = new();
        foreach (var field in dto.Fields)
        {
            NewFields.Add(new FieldDefinitionEntity()
            {
                Id = Guid.NewGuid(),
                ModelId = modelId,
                Name = field.Name,
                Type = field.Type
            });
        }

        return new()
        {
            Id = modelId,
            ProjectId = projectId,
            Name = dto.Name,
            Fields = NewFields
        };

    }

    public static ModelDefinitionResponseDto FromModelDefinitionEntity(ModelDefinitionEntity model)
    {
        List<FieldDefinitionResponseDto> fields = new();
        foreach (var field in model.Fields)
        {
            fields.Add(new(Id: field.Id, Name: field.Name, Type: field.Type));
        }

        return new(Id: model.Id, ProjectId: model.ProjectId, Name: model.Name, Fields: fields);
    }

}