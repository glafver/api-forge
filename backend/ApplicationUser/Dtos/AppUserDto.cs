namespace backend.ApplicationUser.Dtos;

public record AppUserDto(
    string Id,
    string Username,
    string Email,
    bool MustChangePassword,
    bool IsBlocked,
    DateTime CreatedAt
);