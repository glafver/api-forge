using System.Globalization;
using backend.Definition.Entities;
using backend.ModelRecord.Dto;

namespace backend.ModelRecord.Validators;

public static class RecordFieldsValidators
{
    public static bool IsFieldValid(string value, string type)
    {
        return type.ToLower() switch
        {
            "string" => true,
            "int" => int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out _),
            "double" => double.TryParse(value, NumberStyles.Float | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out _),
            "bool" => bool.TryParse(value, out _),
            "guid" => Guid.TryParse(value, out _),
            _ => false
        };
    }

    public static (bool isValid, string? error) ValidateFields(ModelDefinitionEntity entity, CreateRecordFieldsDto dto)
    {
        // Ensure every field defined on the model is present and has a value of the correct type.
        foreach (var modelField in entity.Fields)
        {
            var providedField = dto.RecordFields.FirstOrDefault(f => f.Name == modelField.Name);

            if (providedField is null)
            {
                return (false, $"The field '{modelField.Name}' is missing");
            }

            if (!IsFieldValid(providedField.Value, modelField.Type))
            {
                return (false, $"The field '{modelField.Name}' expects a value of type '{modelField.Type}'");
            }
        }

        // Reject fields that are not part of the model definition.
        foreach (var providedField in dto.RecordFields)
        {
            if (!entity.Fields.Any(f => f.Name == providedField.Name))
            {
                return (false, $"The field '{providedField.Name}' is not defined for this model");
            }
        }

        return (true, null);
    }
}
