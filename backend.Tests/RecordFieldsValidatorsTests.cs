using backend.Definition.Entities;
using backend.ModelRecord.Dto;
using backend.ModelRecord.Validators;
using Xunit;

namespace backend.Tests;

public class RecordFieldsValidatorsTests
{
    private static ModelDefinitionEntity CreateModel(params (string Name, string Type)[] fields)
    {
        var modelId = Guid.NewGuid();
        return new ModelDefinitionEntity
        {
            Id = modelId,
            ProjectId = Guid.NewGuid(),
            Name = "resource",
            Fields = fields
                .Select(f => new FieldDefinitionEntity
                {
                    Id = Guid.NewGuid(),
                    ModelId = modelId,
                    Name = f.Name,
                    Type = f.Type
                })
                .ToList()
        };
    }

    private static CreateRecordFieldsDto CreateDto(params (string Name, string Value)[] fields) =>
        new(fields.Select(f => new RecordFieldDto(f.Name, f.Value)).ToList());

    [Fact]
    public void ValidateFields_IsValid_WhenAllFieldsArePresentAndTypedCorrectly()
    {
        var model = CreateModel(("title", "string"), ("views", "int"));
        var dto = CreateDto(("title", "Hello"), ("views", "42"));

        var (isValid, error) = RecordFieldsValidators.ValidateFields(model, dto);

        Assert.True(isValid);
        Assert.Null(error);
    }

    [Fact]
    public void ValidateFields_ReturnsMissingFieldError_WhenAFieldIsAbsent()
    {
        var model = CreateModel(("title", "string"), ("views", "int"));
        var dto = CreateDto(("title", "Hello"));

        var (isValid, error) = RecordFieldsValidators.ValidateFields(model, dto);

        Assert.False(isValid);
        Assert.Contains("views", error ?? string.Empty);
    }

    [Fact]
    public void ValidateFields_ReturnsTypeError_WhenValueDoesNotMatchFieldType()
    {
        var model = CreateModel(("views", "int"));
        var dto = CreateDto(("views", "not-a-number"));

        var (isValid, error) = RecordFieldsValidators.ValidateFields(model, dto);

        Assert.False(isValid);
        Assert.Contains("views", error ?? string.Empty);
        Assert.Contains("int", error ?? string.Empty);
    }

    [Fact]
    public void ValidateFields_ReturnsUnknownFieldError_WhenUndeclaredFieldIsProvided()
    {
        var model = CreateModel(("title", "string"));
        var dto = CreateDto(("title", "Hello"), ("extra", "nope"));

        var (isValid, error) = RecordFieldsValidators.ValidateFields(model, dto);

        Assert.False(isValid);
        Assert.Contains("extra", error ?? string.Empty);
    }

    [Theory]
    [InlineData("string", "anything")]
    [InlineData("int", "42")]
    [InlineData("double", "3.14")]
    [InlineData("bool", "true")]
    [InlineData("guid", "00000000-0000-0000-0000-000000000000")]
    public void IsFieldValid_ReturnsTrue_ForValidValues(string type, string value)
    {
        Assert.True(RecordFieldsValidators.IsFieldValid(value, type));
    }

    [Theory]
    [InlineData("int", "not-an-int")]
    [InlineData("double", "not-a-double")]
    [InlineData("bool", "not-a-bool")]
    [InlineData("guid", "not-a-guid")]
    [InlineData("unknown", "whatever")]
    public void IsFieldValid_ReturnsFalse_ForInvalidValues(string type, string value)
    {
        Assert.False(RecordFieldsValidators.IsFieldValid(value, type));
    }
}
