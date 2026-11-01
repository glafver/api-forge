using backend.Definition.Dto;
using backend.Definition.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Definition.Controller;

[ApiController]
[Authorize]
[Route("api/projects/{projectId:guid}/definitions")]
public class ProjectDefinitionsController : ControllerBase
{
    private readonly IDefinitionService service;

    public ProjectDefinitionsController(IDefinitionService definitionService)
    {
        service = definitionService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ModelDefinitionResponseDto>>> List(Guid projectId)
    {
        var result = await service.ListByProjectAsync(projectId);
        if (!result.IsSuccess)
        {
            return StatusCode(result.Error?.Status ?? StatusCodes.Status400BadRequest, result.Error);
        }

        return Ok(result.Data);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ModelDefinitionResponseDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<ModelDefinitionResponseDto>> Create(Guid projectId, [FromBody] ModelDefinitionCreateDto dto)
    {
        var result = await service.CreateAsync(projectId, dto);
        if (result.IsSuccess && result.Data is ModelDefinitionResponseDto)
        {
            return CreatedAtAction(nameof(List), new { projectId }, result.Data);
        }

        return BadRequest(result.Error);
    }

    [HttpDelete("{definitionId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDefinition(Guid projectId, Guid definitionId)
    {
        var result = await service.DeleteDefinitionAsync(projectId, definitionId);
        if (!result.IsSuccess)
        {
            return StatusCode(result.Error?.Status ?? StatusCodes.Status400BadRequest, result.Error);
        }

        return NoContent();
    }

    [HttpDelete("{definitionId:guid}/fields/{fieldId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteField(Guid projectId, Guid definitionId, Guid fieldId)
    {
        var result = await service.DeleteFieldAsync(projectId, definitionId, fieldId);
        if (!result.IsSuccess)
        {
            return StatusCode(result.Error?.Status ?? StatusCodes.Status400BadRequest, result.Error);
        }

        return NoContent();
    }

    [HttpPost("{definitionId:guid}/fields")]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(FieldDefinitionResponseDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<FieldDefinitionResponseDto>> AddField(
        Guid projectId,
        Guid definitionId,
        [FromBody] FieldDefinitionCreateDto dto
    )
    {
        var result = await service.AddFieldAsync(projectId, definitionId, dto);
        if (result.IsSuccess && result.Data is FieldDefinitionResponseDto)
        {
            return CreatedAtAction(nameof(List), new { projectId }, result.Data);
        }

        return BadRequest(result.Error);
    }
}
