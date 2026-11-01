using backend.ApplicationUser.Dto;
using backend.ApiResponse.OperationResults;
using backend.ApplicationUser.Models;
using backend.ApplicationUser.Dtos;

namespace backend.ApplicationUser.Services;

public interface IUserService
{
    Task<OperationResult<AppUserDto>> CreateAsync(UserCreateDto dto);
    Task<OperationResult<AppUserDto>> GetByIdAsync(string id);
    Task<OperationResult<AuthenticatedUser>> LoginAsync(UserLoginDto dto);
    Task<OperationResult<AppUserDto>> UpdateAsync(UserUpdateDto entity, string email);
    Task<OperationResult<PublicUserProfileDto>> GetPublicProfileAsync(string id);
    Task<OperationResult<IEnumerable<UserSearchDto>>> SearchUsersAsync(string query, int limit);
    Task<OperationResult<bool>> ChangePasswordAsync(string userId, ChangePasswordDto dto);
    Task<OperationResult<bool>> DeleteAccountAsync(string userId);
}
