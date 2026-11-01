using backend.ApplicationUser.Dtos;
using backend.ApplicationUser.Entities;

namespace backend.ApplicationUser.Factory;

internal static class AppUserFactory
{
    public static AppUser CreateAppUserFromDto(UserCreateDto dto)
    {
        return new AppUser
        {
            Id = Guid.NewGuid().ToString(),
            Email = dto.Email,
            UserName = dto.Username,
            MustChangePassword = false,
            IsBlocked = false,
            CreatedAt = DateTime.UtcNow
        };
    }
}