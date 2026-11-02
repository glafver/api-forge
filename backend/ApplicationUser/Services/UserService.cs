using backend.ApplicationUser.Entities;
using backend.ApplicationUser.Factory;
using backend.ApiResponse.OperationResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using backend.ApplicationUser.Models;
using backend.ApplicationUser.Dtos;
using backend.Data;

namespace backend.ApplicationUser.Services;

internal class UserService : IUserService
{
    private readonly UserManager<AppUser> userManager;
    private readonly IConfiguration _config;
    private readonly SignInManager<AppUser> _signInManager;
    private readonly ILogger<IUserService> _logger;
    private readonly ApplicationDBContext _dbContext;

    public UserService(
        UserManager<AppUser> userManager,
        IConfiguration config,
        SignInManager<AppUser> signInManager,
        ILogger<IUserService> logger,
        ApplicationDBContext dbContext
    )
    {
        _config = config;
        _logger = logger;
        _signInManager = signInManager;
        this.userManager = userManager;
        _dbContext = dbContext;
    }


    public async Task<OperationResult<AppUserDto>> CreateAsync(UserCreateDto dto)
    {
        var existingByEmail = await userManager.FindByEmailAsync(dto.Email);
        if (existingByEmail is not null)
        {
            return OperationResult<AppUserDto>.Failure(new OperationError(Message: "Email is already in use", Status: 400));
        }

        var existingByUsername = await userManager.FindByNameAsync(dto.Username);
        if (existingByUsername is not null)
        {
            return OperationResult<AppUserDto>.Failure(new OperationError(Message: "Username is already in use", Status: 400));
        }

        var newUser = AppUserFactory.CreateAppUserFromDto(dto);

        try
        {
            IdentityResult result = await userManager.CreateAsync(newUser, dto.Password);
            if (result.Succeeded is false)
            {
                string error = result.Errors.ToList().First().Description;
                return OperationResult<AppUserDto>.Failure(new OperationError(Message: error, Status: 400));
            }

            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(newUser, "User");
                return OperationResult<AppUserDto>.Success(MapToDto(newUser));
            }
        }
        catch (DbUpdateException)
        {
            return OperationResult<AppUserDto>.Failure(new OperationError(Message: "Registration failed", Status: 400));
        }

        return OperationResult<AppUserDto>.Failure(new OperationError(Message: "Registration failed", Status: 400));
    }

    public async Task<OperationResult<AppUserDto>> GetByIdAsync(string id)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return OperationResult<AppUserDto>.Failure(new OperationError(Message: "Unauthorized", Status: 401));
        }

        return OperationResult<AppUserDto>.Success(MapToDto(user));
    }

    public async Task<OperationResult<AuthenticatedUser>> LoginAsync(UserLoginDto dto)
    {
        _logger.LogInformation("Login attempt for {Email}", dto.Email);
        var user = await userManager.FindByEmailAsync(dto.Email);

        if (user is null)
        {
            _logger.LogInformation("Login attempt failed for {Email} - User not found", dto.Email);
            return OperationResult<AuthenticatedUser>.Failure(new OperationError(Message: "Invalid email or password", Status: 401));
        }

        if (user.IsBlocked)
        {
            _logger.LogInformation("Login attempt blocked for {Email} - User is blocked", dto.Email);
            return OperationResult<AuthenticatedUser>.Failure(new OperationError(Message: "Account is blocked", Status: 403));
        }

        var loginName = user.UserName ?? user.Email ?? dto.Email;
        var result = await _signInManager.PasswordSignInAsync(loginName, dto.Password, isPersistent: false, lockoutOnFailure: true);
        if (result.Succeeded is false)
        {
            if (result.IsLockedOut)
            {
                _logger.LogInformation("Login attempt failed for {Email} - Account locked due to failed attempts", dto.Email);
                return OperationResult<AuthenticatedUser>.Failure(new OperationError("Account locked due to failed attempts", 423));
            }
            _logger.LogInformation("Login attempt failed for {Email} - Invalid email or password", dto.Email);
            return OperationResult<AuthenticatedUser>.Failure(new OperationError(Message: "Invalid email or password", Status: 401));
        }

        string token = await GenerateJwtToken(user);
        var authUser = new AuthenticatedUser(MapToDto(user), token);
        _logger.LogInformation("Login succeeded for {Email}", dto.Email);
        return OperationResult<AuthenticatedUser>.Success(authUser);
    }

    public async Task<OperationResult<AppUserDto>> UpdateAsync(UserUpdateDto entity, string email)
    {
        AppUser? user = await userManager.FindByEmailAsync(email);

        if (user is null)
        {
            return OperationResult<AppUserDto>.Failure(new OperationError(Message: "Operation failed", Status: 401));
        }

        if (!string.IsNullOrWhiteSpace(entity.Username) &&
            !string.Equals(user.UserName, entity.Username, StringComparison.OrdinalIgnoreCase))
        {
            var existingUser = await userManager.FindByNameAsync(entity.Username);
            if (existingUser is not null)
            {
                return OperationResult<AppUserDto>.Failure(new OperationError(Message: "Username is already in use", Status: 400));
            }
            user.UserName = entity.Username;
        }

        if (!string.IsNullOrWhiteSpace(entity.Email) &&
            !string.Equals(user.Email, entity.Email, StringComparison.OrdinalIgnoreCase))
        {
            var existingEmail = await userManager.FindByEmailAsync(entity.Email);
            if (existingEmail is not null)
            {
                return OperationResult<AppUserDto>.Failure(new OperationError(Message: "Email is already in use", Status: 400));
            }
            user.Email = entity.Email;
        }

        var result = await userManager.UpdateAsync(user);

        if (result.Succeeded)
        {
            return OperationResult<AppUserDto>.Success(MapToDto(user));
        }

        return OperationResult<AppUserDto>.Failure(new OperationError(Message: "Operation failed", Status: 401));
    }

    public async Task<OperationResult<PublicUserProfileDto>> GetPublicProfileAsync(string id)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return OperationResult<PublicUserProfileDto>.Failure(new OperationError(Message: "User not found", Status: 404));
        }

        var dto = new PublicUserProfileDto(
            user.Id,
            user.UserName ?? string.Empty,
            user.CreatedAt
        );

        return OperationResult<PublicUserProfileDto>.Success(dto);
    }

    public async Task<OperationResult<IEnumerable<UserSearchDto>>> SearchUsersAsync(string query, int limit)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return OperationResult<IEnumerable<UserSearchDto>>.Success(Array.Empty<UserSearchDto>());
        }

        var term = query.Trim();
        var take = limit <= 0 ? 8 : Math.Min(limit, 20);

        var users = await userManager.Users
            .AsNoTracking()
            .Where(u => (u.Email ?? "").Contains(term) || (u.UserName ?? "").Contains(term))
            .OrderBy(u => u.UserName)
            .Take(take)
            .Select(u => new UserSearchDto(
                u.Id,
                u.UserName ?? string.Empty,
                u.Email ?? string.Empty
            ))
            .ToListAsync();

        return OperationResult<IEnumerable<UserSearchDto>>.Success(users);
    }

    public async Task<OperationResult<bool>> ChangePasswordAsync(string userId, ChangePasswordDto dto)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return OperationResult<bool>.Failure(new OperationError(Message: "Unauthorized", Status: 401));
        }

        var result = await userManager.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
        if (!result.Succeeded)
        {
            var error = result.Errors.FirstOrDefault()?.Description ?? "Password change failed";
            return OperationResult<bool>.Failure(new OperationError(Message: error, Status: 400));
        }

        if (user.MustChangePassword)
        {
            user.MustChangePassword = false;
            await userManager.UpdateAsync(user);
        }

        return OperationResult<bool>.Success(true);
    }

    public async Task<OperationResult<bool>> DeleteAccountAsync(string userId)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return OperationResult<bool>.Failure(new OperationError(Message: "Unauthorized", Status: 401));
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync();

        try
        {
            var ownedProjects = await _dbContext.Projects
                .Where(p => p.OwnerId == userId)
                .ToListAsync();
            if (ownedProjects.Count > 0)
            {
                _dbContext.Projects.RemoveRange(ownedProjects);
            }

            var memberEntries = await _dbContext.ProjectMembers
                .Where(pm => pm.UserId == userId)
                .ToListAsync();
            if (memberEntries.Count > 0)
            {
                _dbContext.ProjectMembers.RemoveRange(memberEntries);
            }

            var invitations = await _dbContext.ProjectInvitations
                .Where(pi =>
                    pi.InvitedUserId == userId ||
                    pi.InvitedByUserId == userId ||
                    (user.Email != null && pi.Email == user.Email)
                )
                .ToListAsync();
            if (invitations.Count > 0)
            {
                _dbContext.ProjectInvitations.RemoveRange(invitations);
            }

            await _dbContext.SaveChangesAsync();

            user.IsBlocked = true;
            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                var error = updateResult.Errors.FirstOrDefault()?.Description ?? "Account deletion failed";
                await transaction.RollbackAsync();
                return OperationResult<bool>.Failure(new OperationError(Message: error, Status: 400));
            }

            await transaction.CommitAsync();
            return OperationResult<bool>.Success(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete account for user {UserId}", userId);
            await transaction.RollbackAsync();
            return OperationResult<bool>.Failure(new OperationError(Message: "Account deletion failed", Status: 500));
        }
    }

    private static AppUserDto MapToDto(AppUser user)
    {
        return new AppUserDto(
            user.Id,
            user.UserName ?? string.Empty,
            user.Email ?? string.Empty,
            user.MustChangePassword,
            user.IsBlocked,
            user.CreatedAt
        );
    }

    private async Task<string> GenerateJwtToken(AppUser user)
    {
        var jwtSection = _config.GetSection("Jwt");
        var key = jwtSection["Key"];
        var issuer = jwtSection["Issuer"];
        var audience = jwtSection["Audience"];
        var expiryMinutes = jwtSection.GetValue<int>("ExpiryMinutes", 60);

        if (key is null)
        {
            throw new InvalidOperationException("JWT Key is not configured.");
        }

        if (user.Email is null)
        {
            throw new InvalidOperationException("User email is missing.");
        }

        var keyBytes = Encoding.UTF8.GetBytes(key);
        var securityKey = new SymmetricSecurityKey(keyBytes);
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);



        var claims = new List<Claim>
        {
            new Claim(type: JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(type: JwtRegisteredClaimNames.Email, user.Email),
            new Claim(type: ClaimTypes.NameIdentifier, user.Id)
        };


        var roles = await userManager.GetRolesAsync(user);
        claims.AddRange(roles.Select(r => new Claim(type: ClaimTypes.Role, r)));

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }



}