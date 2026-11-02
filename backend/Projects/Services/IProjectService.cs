using backend.ApiResponse.OperationResults;
using backend.Projects.Dtos;

namespace backend.Projects.Services;

public interface IProjectService
{
    Task<OperationResult<IEnumerable<ProjectDto>>> GetMyProjectsAsync(string userId);
    Task<OperationResult<string>> GetDevKeyAsync(string userId, Guid projectId);
    Task<OperationResult<ProjectDto>> CreateProjectAsync(string userId, CreateProjectDto dto);
    Task<OperationResult<ProjectDto>> UpdateProjectAsync(string userId, Guid projectId, UpdateProjectDto dto);
    Task<OperationResult<bool>> DeleteProjectAsync(string userId, Guid projectId);
    Task<OperationResult<IEnumerable<ProjectMemberDto>>> GetMembersAsync(string userId, Guid projectId);
    Task<OperationResult<bool>> RemoveMemberAsync(string userId, Guid projectId, string memberId);
    Task<OperationResult<ProjectInvitationDto>> CreateInvitationAsync(string userId, Guid projectId, ProjectInvitationCreateDto dto);
    Task<OperationResult<IEnumerable<ProjectInvitationDto>>> GetMyInvitationsAsync(string userId);
    Task<OperationResult<IEnumerable<ProjectInvitationDto>>> GetProjectInvitationsAsync(string userId, Guid projectId);
    Task<OperationResult<bool>> CancelInvitationAsync(string userId, Guid projectId, Guid invitationId);
    Task<OperationResult<bool>> AcceptInvitationAsync(string userId, Guid invitationId);
    Task<OperationResult<bool>> DeclineInvitationAsync(string userId, Guid invitationId);
}
