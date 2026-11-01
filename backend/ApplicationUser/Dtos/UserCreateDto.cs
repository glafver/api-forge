using System.ComponentModel.DataAnnotations;

namespace backend.ApplicationUser.Dtos;

public record UserCreateDto(
    [Required, StringLength(50, MinimumLength = 2)]
    string Username,

    [Required, EmailAddress, StringLength(254)]
    string Email,

    [Required, StringLength(50, MinimumLength = 6)]
    string Password
);