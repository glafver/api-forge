using System.Security.Claims;
using backend.ModelRecord.Dto;
using backend.ModelRecord.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.ModelRecord.Controller;

[ApiController]
[Authorize]
[Route("api/{modelName}")]
public class ModelRecordsController : ControllerBase
{
    private readonly IModelRecordService service;

    public ModelRecordsController(IModelRecordService modelRecordService)
    {
        service = modelRecordService;
    }

    [HttpPost]
    public async Task<IActionResult> CreateRecord(string modelName, [FromBody] CreateRecordFieldsDto dto)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await service.CreateAsync(userId, dto, modelName);
        if (result.IsSuccess && result.Data is not null)
        {
            return Created($"/api/{modelName}/{result.Data.Id}", result.Data);
        }

        return StatusCode(result.Error?.Status ?? StatusCodes.Status400BadRequest, result.Error);
    }

    [HttpGet]
    public async Task<IActionResult> GetRecords(
        string modelName,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? sort = null,
        [FromQuery] string? order = "asc")
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        // Any query parameter that is not a reserved one is treated as a filter on that field.
        var filters = new Dictionary<string, string>();
        foreach (var query in Request.Query)
        {
            if (query.Key is "page" or "pageSize" or "sort" or "order")
            {
                continue;
            }

            filters[query.Key] = query.Value.ToString();
        }

        var result = await service.QueryRecordsAsync(userId, modelName, page, pageSize, sort, order, filters);
        if (!result.IsSuccess)
        {
            return StatusCode(result.Error?.Status ?? StatusCodes.Status400BadRequest, result.Error);
        }

        return Ok(result.Data);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetRecord(string modelName, Guid id)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await service.GetRecordByIdAsync(userId, modelName, id);
        if (!result.IsSuccess)
        {
            return StatusCode(result.Error?.Status ?? StatusCodes.Status400BadRequest, result.Error);
        }

        return Ok(result.Data);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateRecord(string modelName, Guid id, [FromBody] CreateRecordFieldsDto dto)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await service.UpdateRecordAsync(userId, modelName, id, dto);
        if (!result.IsSuccess)
        {
            return StatusCode(result.Error?.Status ?? StatusCodes.Status400BadRequest, result.Error);
        }

        return Ok(result.Data);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteRecord(string modelName, Guid id)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await service.DeleteRecordAsync(userId, modelName, id);
        if (!result.IsSuccess)
        {
            return StatusCode(result.Error?.Status ?? StatusCodes.Status400BadRequest, result.Error);
        }

        return NoContent();
    }

    private string? GetUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier);
    }
}
