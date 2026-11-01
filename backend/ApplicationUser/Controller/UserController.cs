using backend.ApplicationUser.Entities;
using backend.ApplicationUser.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using backend.ApplicationUser.Dtos;

namespace backend.ApplicationUser.Controller;

[ApiController]
[Route("api/user")]
public class UserController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly IConfiguration _configuration;
    private readonly SignInManager<AppUser> _signInManager;
    public UserController(IUserService userService, IConfiguration configuration, SignInManager<AppUser> signInManager)
    {
        _userService = userService;
        _configuration = configuration;
        _signInManager = signInManager;
    }

    [HttpPost(Name = "Creates a new user")]
    [ProducesResponseType(typeof(AppUserDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AppUserDto?>> Create([FromBody] UserCreateDto userDto)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var response = await _userService.CreateAsync(userDto);
        if (!response.IsSuccess)
        {
            return BadRequest(response.Error);
        }

        return CreatedAtAction(nameof(Create), response.Data);
    }


    [HttpPost("login")]
    [ProducesResponseType(typeof(AppUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AppUserDto>> Login([FromBody] UserLoginDto loginDto)
    {
        var response = await _userService.LoginAsync(loginDto);
        if (!response.IsSuccess)
        {
            return StatusCode(response.Error?.Status ?? StatusCodes.Status401Unauthorized, response.Error);
        }

        if (response.Data.JwtToken is string token && response.Data.User is AppUserDto)
        {
            Response.Cookies.Append("access_token", token, new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax
            });

            return Ok(response.Data.User);
        }

        return Unauthorized();
    }

    [HttpGet("info")]
    [Authorize]
    [ProducesResponseType(typeof(AppUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AppUserDto>> UserInfo()
    {

        string? id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id is null)
        {
            return Unauthorized();
        }

        var res = await _userService.GetByIdAsync(id);

        if (!res.IsSuccess)
        {
            return Unauthorized();
        }

        return Ok(res.Data);
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PublicUserProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicUserProfileDto>> GetPublicProfile(string id)
    {
        var res = await _userService.GetPublicProfileAsync(id);
        if (!res.IsSuccess)
        {
            var status = res.Error?.Status ?? StatusCodes.Status400BadRequest;
            return StatusCode(status, res.Error);
        }

        return Ok(res.Data);
    }

    [HttpGet("verify")]
    [Authorize]
    [ProducesResponseType(typeof(AppUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AppUserDto>> UserVerify()
    {
        await Task.CompletedTask;
        return Ok();
    }

    [HttpGet("search")]
    [Authorize]
    [ProducesResponseType(typeof(IEnumerable<UserSearchDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<UserSearchDto>>> SearchUsers(
        [FromQuery] string query,
        [FromQuery] int limit = 8
    )
    {
        var response = await _userService.SearchUsersAsync(query, limit);
        if (!response.IsSuccess)
        {
            return StatusCode(response.Error?.Status ?? StatusCodes.Status400BadRequest, response.Error);
        }

        return Ok(response.Data);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        Response.Cookies.Delete("access_token", new CookieOptions
        {
            Path = "/"
        });

        return Ok(new { Message = "Logged out" });
    }


    [HttpPost("change-password")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        string? id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id is null)
        {
            return Unauthorized();
        }

        var res = await _userService.ChangePasswordAsync(id, dto);
        if (!res.IsSuccess)
        {
            return StatusCode(res.Error?.Status ?? StatusCodes.Status400BadRequest, res.Error);
        }

        return Ok(new { Message = "Password updated" });
    }


    [HttpDelete("me")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> DeleteAccount()
    {
        string? id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id is null)
        {
            return Unauthorized();
        }

        var res = await _userService.DeleteAccountAsync(id);
        if (!res.IsSuccess)
        {
            return StatusCode(res.Error?.Status ?? StatusCodes.Status400BadRequest, res.Error);
        }

        await _signInManager.SignOutAsync();
        Response.Cookies.Delete("access_token", new CookieOptions
        {
            Path = "/"
        });

        return Ok(new { Message = "Account deleted" });
    }


    [HttpPatch()]
    [Authorize]
    [ProducesResponseType(typeof(AppUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AppUserDto>> UserUpdate([FromBody] UserUpdateDto updateDto)
    {
        string? email = User.FindFirstValue(ClaimTypes.Email);
        if (email is null)
        {
            return Unauthorized();
        }

        var res = await _userService.UpdateAsync(updateDto, email);

        if (res.IsSuccess is true)
        {
            return Ok(res.Data);
        }

        var status = res.Error?.Status ?? StatusCodes.Status400BadRequest;
        return StatusCode(status, res.Error);
    }

}