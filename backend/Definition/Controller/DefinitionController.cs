
using backend.Definition.Dto;
using backend.Definition.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Definition.Controller;


[ApiController]
[Authorize]
[Route("api/define-models")]
public class DefinitionController : ControllerBase
{
    private readonly IModelDefinitionService service;

    public DefinitionController(IModelDefinitionService definitionService)
    {
        service = definitionService;
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ModelDefinitionResponseDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<ModelDefinitionResponseDto>> Create([FromBody] ModelDefinitionCreateDto dto)
    {
        var result = await service.CreateAsync(dto);
        if (result.IsSuccess && result.Data is ModelDefinitionResponseDto)
        {
            return CreatedAtAction(nameof(Create), new { id = result.Data.Id }, result.Data);
        }
        else
        {
            return BadRequest(result.Error);
        }
    }

    [HttpGet("{modelName}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ModelDefinitionResponseDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ModelDefinitionResponseDto>> GetByName(string modelName)
    {
        var result = await service.FindByNameAsync(modelName);
        if (result.IsSuccess && result.Data is ModelDefinitionResponseDto)
        {
            return Ok(result.Data);
        }
        else
        {
            return NotFound();
        }
    }

}