using System.ComponentModel.DataAnnotations;

namespace backend.ApplicationUser.Dtos;

public record UserLoginDto(

    [Required, EmailAddress, StringLength(254)]
    string Email,
    [Required, StringLength(50, MinimumLength = 6)]
    string Password
)
{
}