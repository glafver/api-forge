using System.Security.Claims;
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
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await service.ListByProjectAsync(userId, projectId);
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
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await service.CreateAsync(userId, projectId, dto);
        if (result.IsSuccess && result.Data is ModelDefinitionResponseDto)
        {
            return CreatedAtAction(nameof(List), new { projectId }, result.Data);
        }

        return StatusCode(result.Error?.Status ?? StatusCodes.Status400BadRequest, result.Error);
    }

    [HttpDelete("{definitionId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDefinition(Guid projectId, Guid definitionId)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await service.DeleteDefinitionAsync(userId, projectId, definitionId);
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
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await service.DeleteFieldAsync(userId, projectId, definitionId, fieldId);
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
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await service.AddFieldAsync(userId, projectId, definitionId, dto);
        if (result.IsSuccess && result.Data is FieldDefinitionResponseDto)
        {
            return CreatedAtAction(nameof(List), new { projectId }, result.Data);
        }

        return StatusCode(result.Error?.Status ?? StatusCodes.Status400BadRequest, result.Error);
    }

    private string? GetUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier);
    }
}
