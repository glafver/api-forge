using backend.ApplicationUser.Dtos;

namespace backend.ApplicationUser.Models;


public readonly struct AuthenticatedUser
{
    public AppUserDto User { get; }
    public string JwtToken { get; }

    public AuthenticatedUser(AppUserDto user, string jwtToken)
    {
        User = user;
        JwtToken = jwtToken;
    }

}
