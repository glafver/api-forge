using backend.ApiResponse.OperationResults;
using backend.ApplicationUser.Entities;
using backend.AppConfig;
using backend.Data;
using backend.Projects.Dtos;
using backend.Projects.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace backend.Projects.Services;

internal class ProjectService : IProjectService
{
    private readonly ApplicationDBContext _dbContext;
    private readonly UserManager<AppUser> _userManager;

    public ProjectService(ApplicationDBContext dbContext, UserManager<AppUser> userManager)
    {
        _dbContext = dbContext;
        _userManager = userManager;
    }

    public async Task<OperationResult<IEnumerable<ProjectDto>>> GetMyProjectsAsync(string userId)
    {
        var projects = await _dbContext.Projects
            .Where(p => p.Members.Any(m => m.UserId == userId))
            .Select(p => new ProjectDto(
                p.Id,
                p.Name,
                p.OwnerId,
                p.Owner != null ? p.Owner.UserName ?? string.Empty : string.Empty,
                p.CreatedAt
            ))
            .ToListAsync();

        return OperationResult<IEnumerable<ProjectDto>>.Success(projects);
    }

    public async Task<OperationResult<string>> GetDevKeyAsync(string userId, Guid projectId)
    {
        var project = await _dbContext.Projects
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Id == projectId);

        if (project is null)
        {
            return Failure<string>("Project not found", StatusCodes.Status404NotFound);
        }

        if (!IsMember(project, userId))
        {
            return Failure<string>("Forbidden", StatusCodes.Status403Forbidden);
        }

        return OperationResult<string>.Success(DevKeyGenerator.Generate(projectId, DateTime.UtcNow));
    }

    public async Task<OperationResult<ProjectDto>> CreateProjectAsync(string userId, CreateProjectDto dto)
    {
        var owner = await _userManager.FindByIdAsync(userId);
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            OwnerId = userId,
            CreatedAt = DateTime.UtcNow
        };

        project.Members.Add(new ProjectMember
        {
            ProjectId = project.Id,
            UserId = userId,
            Role = ProjectRole.Owner,
            AddedAt = DateTime.UtcNow
        });

        _dbContext.Projects.Add(project);
        await _dbContext.SaveChangesAsync();

        return OperationResult<ProjectDto>.Success(new ProjectDto(
            project.Id,
            project.Name,
            project.OwnerId,
            owner?.UserName ?? string.Empty,
            project.CreatedAt
        ));
    }

    public async Task<OperationResult<ProjectDto>> UpdateProjectAsync(string userId, Guid projectId, UpdateProjectDto dto)
    {
        var project = await _dbContext.Projects
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Id == projectId);

        if (project is null)
        {
            return Failure<ProjectDto>("Project not found", StatusCodes.Status404NotFound);
        }

        if (!IsOwner(project, userId))
        {
            return Failure<ProjectDto>("Forbidden", StatusCodes.Status403Forbidden);
        }

        project.Name = dto.Name;
        await _dbContext.SaveChangesAsync();

        var owner = await _userManager.FindByIdAsync(project.OwnerId);
        return OperationResult<ProjectDto>.Success(new ProjectDto(
            project.Id,
            project.Name,
            project.OwnerId,
            owner?.UserName ?? string.Empty,
            project.CreatedAt
        ));
    }

    public async Task<OperationResult<bool>> DeleteProjectAsync(string userId, Guid projectId)
    {
        var project = await _dbContext.Projects
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Id == projectId);

        if (project is null)
        {
            return Failure<bool>("Project not found", StatusCodes.Status404NotFound);
        }

        if (!IsOwner(project, userId))
        {
            return Failure<bool>("Forbidden", StatusCodes.Status403Forbidden);
        }

        _dbContext.Projects.Remove(project);
        await _dbContext.SaveChangesAsync();

        return OperationResult<bool>.Success(true);
    }

    public async Task<OperationResult<IEnumerable<ProjectMemberDto>>> GetMembersAsync(string userId, Guid projectId)
    {
        var project = await _dbContext.Projects
            .Include(p => p.Members)
            .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(p => p.Id == projectId);

        if (project is null)
        {
            return Failure<IEnumerable<ProjectMemberDto>>("Project not found", StatusCodes.Status404NotFound);
        }

        if (!IsMember(project, userId))
        {
            return Failure<IEnumerable<ProjectMemberDto>>("Forbidden", StatusCodes.Status403Forbidden);
        }

        var members = project.Members
            .Where(m => m.User is not null)
            .Select(m => new ProjectMemberDto(
                m.UserId,
                m.UserId,
                m.User!.UserName ?? string.Empty,
                m.User!.Email ?? string.Empty
            ))
            .ToList();

        return OperationResult<IEnumerable<ProjectMemberDto>>.Success(members);
    }

    public async Task<OperationResult<bool>> RemoveMemberAsync(string userId, Guid projectId, string memberId)
    {
        var project = await _dbContext.Projects
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Id == projectId);

        if (project is null)
        {
            return Failure<bool>("Project not found", StatusCodes.Status404NotFound);
        }

        var isSelfRemoval = userId == memberId;
        if (!isSelfRemoval && !IsOwner(project, userId))
        {
            return Failure<bool>("Forbidden", StatusCodes.Status403Forbidden);
        }

        if (project.OwnerId == memberId)
        {
            return Failure<bool>("Owner cannot be removed", StatusCodes.Status400BadRequest);
        }

        var member = project.Members.FirstOrDefault(m => m.UserId == memberId);
        if (member is null)
        {
            return Failure<bool>("Member not found", StatusCodes.Status404NotFound);
        }

        _dbContext.ProjectMembers.Remove(member);
        await _dbContext.SaveChangesAsync();

        return OperationResult<bool>.Success(true);
    }

    public async Task<OperationResult<ProjectInvitationDto>> CreateInvitationAsync(
        string userId,
        Guid projectId,
        ProjectInvitationCreateDto dto
    )
    {
        var project = await _dbContext.Projects
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Id == projectId);

        if (project is null)
        {
            return Failure<ProjectInvitationDto>("Project not found", StatusCodes.Status404NotFound);
        }

        if (!IsOwner(project, userId))
        {
            return Failure<ProjectInvitationDto>("Forbidden", StatusCodes.Status403Forbidden);
        }

        var invitedUser = await _userManager.FindByEmailAsync(dto.Email);
        if (invitedUser is null)
        {
            return Failure<ProjectInvitationDto>("User not found", StatusCodes.Status404NotFound);
        }

        if (project.Members.Any(m => m.UserId == invitedUser.Id))
        {
            return Failure<ProjectInvitationDto>("User already a member", StatusCodes.Status409Conflict);
        }

        var existingInvite = await _dbContext.ProjectInvitations.FirstOrDefaultAsync(pi =>
            pi.ProjectId == projectId &&
            pi.Status == ProjectInvitationStatus.Pending &&
            (pi.InvitedUserId == invitedUser.Id || pi.Email == invitedUser.Email)
        );

        if (existingInvite is not null)
        {
            return Failure<ProjectInvitationDto>("Invitation already sent", StatusCodes.Status409Conflict);
        }

        var invitation = new ProjectInvitation
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            Email = invitedUser.Email ?? dto.Email,
            InvitedUserId = invitedUser.Id,
            InvitedByUserId = userId,
            Status = ProjectInvitationStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.ProjectInvitations.Add(invitation);
        await _dbContext.SaveChangesAsync();

        var inviter = await _userManager.FindByIdAsync(userId);
        return OperationResult<ProjectInvitationDto>.Success(new ProjectInvitationDto(
            invitation.Id,
            project.Id,
            project.Name,
            invitation.Email,
            inviter?.UserName ?? string.Empty,
            invitation.Status,
            invitation.CreatedAt
        ));
    }

    public async Task<OperationResult<IEnumerable<ProjectInvitationDto>>> GetMyInvitationsAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return Failure<IEnumerable<ProjectInvitationDto>>("User not found", StatusCodes.Status404NotFound);
        }

        var email = user.Email ?? string.Empty;
        var invitations = await _dbContext.ProjectInvitations
            .Include(pi => pi.Project)
            .Include(pi => pi.InvitedByUser)
            .Where(pi => pi.Status == ProjectInvitationStatus.Pending &&
                (pi.InvitedUserId == userId || (email != string.Empty && pi.Email == email)))
            .OrderByDescending(pi => pi.CreatedAt)
            .ToListAsync();

        var result = invitations.Select(pi => new ProjectInvitationDto(
            pi.Id,
            pi.ProjectId,
            pi.Project?.Name ?? string.Empty,
            pi.Email,
            pi.InvitedByUser?.UserName ?? string.Empty,
            pi.Status,
            pi.CreatedAt
        ));

        return OperationResult<IEnumerable<ProjectInvitationDto>>.Success(result);
    }

    public async Task<OperationResult<IEnumerable<ProjectInvitationDto>>> GetProjectInvitationsAsync(
        string userId,
        Guid projectId
    )
    {
        var project = await _dbContext.Projects
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Id == projectId);

        if (project is null)
        {
            return Failure<IEnumerable<ProjectInvitationDto>>("Project not found", StatusCodes.Status404NotFound);
        }

        if (!IsOwner(project, userId))
        {
            return Failure<IEnumerable<ProjectInvitationDto>>("Forbidden", StatusCodes.Status403Forbidden);
        }

        var invitations = await _dbContext.ProjectInvitations
            .Include(pi => pi.InvitedByUser)
            .Where(pi => pi.ProjectId == projectId && pi.Status == ProjectInvitationStatus.Pending)
            .OrderByDescending(pi => pi.CreatedAt)
            .ToListAsync();

        var result = invitations.Select(pi => new ProjectInvitationDto(
            pi.Id,
            pi.ProjectId,
            project.Name,
            pi.Email,
            pi.InvitedByUser?.UserName ?? string.Empty,
            pi.Status,
            pi.CreatedAt
        ));

        return OperationResult<IEnumerable<ProjectInvitationDto>>.Success(result);
    }

    public async Task<OperationResult<bool>> CancelInvitationAsync(string userId, Guid projectId, Guid invitationId)
    {
        var project = await _dbContext.Projects
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Id == projectId);

        if (project is null)
        {
            return Failure<bool>("Project not found", StatusCodes.Status404NotFound);
        }

        if (!IsOwner(project, userId))
        {
            return Failure<bool>("Forbidden", StatusCodes.Status403Forbidden);
        }

        var invitation = await _dbContext.ProjectInvitations
            .FirstOrDefaultAsync(pi => pi.Id == invitationId && pi.ProjectId == projectId);

        if (invitation is null)
        {
            return Failure<bool>("Invitation not found", StatusCodes.Status404NotFound);
        }

        if (invitation.Status != ProjectInvitationStatus.Pending)
        {
            return Failure<bool>("Invitation already processed", StatusCodes.Status409Conflict);
        }

        _dbContext.ProjectInvitations.Remove(invitation);
        await _dbContext.SaveChangesAsync();
        return OperationResult<bool>.Success(true);
    }

    public async Task<OperationResult<bool>> AcceptInvitationAsync(string userId, Guid invitationId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return Failure<bool>("User not found", StatusCodes.Status404NotFound);
        }

        var invitation = await _dbContext.ProjectInvitations
            .Include(pi => pi.Project)
            .ThenInclude(p => p!.Members)
            .FirstOrDefaultAsync(pi => pi.Id == invitationId);

        if (invitation is null)
        {
            return Failure<bool>("Invitation not found", StatusCodes.Status404NotFound);
        }

        if (invitation.Status != ProjectInvitationStatus.Pending)
        {
            return Failure<bool>("Invitation already processed", StatusCodes.Status409Conflict);
        }

        var email = user.Email ?? string.Empty;
        var isInvitee = invitation.InvitedUserId == userId || (email != string.Empty && invitation.Email == email);
        if (!isInvitee)
        {
            return Failure<bool>("Forbidden", StatusCodes.Status403Forbidden);
        }

        var project = invitation.Project;
        if (project is null)
        {
            return Failure<bool>("Project not found", StatusCodes.Status404NotFound);
        }

        project.Members ??= new List<ProjectMember>();

        if (project.Members.Any(m => m.UserId == userId))
        {
            invitation.Status = ProjectInvitationStatus.Accepted;
            invitation.RespondedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();
            return OperationResult<bool>.Success(true);
        }

        project.Members.Add(new ProjectMember
        {
            ProjectId = project.Id,
            UserId = userId,
            Role = ProjectRole.Member,
            AddedAt = DateTime.UtcNow
        });

        invitation.Status = ProjectInvitationStatus.Accepted;
        invitation.RespondedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return OperationResult<bool>.Success(true);
    }

    public async Task<OperationResult<bool>> DeclineInvitationAsync(string userId, Guid invitationId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return Failure<bool>("User not found", StatusCodes.Status404NotFound);
        }

        var invitation = await _dbContext.ProjectInvitations
            .FirstOrDefaultAsync(pi => pi.Id == invitationId);

        if (invitation is null)
        {
            return Failure<bool>("Invitation not found", StatusCodes.Status404NotFound);
        }

        if (invitation.Status != ProjectInvitationStatus.Pending)
        {
            return Failure<bool>("Invitation already processed", StatusCodes.Status409Conflict);
        }

        var email = user.Email ?? string.Empty;
        var isInvitee = invitation.InvitedUserId == userId || (email != string.Empty && invitation.Email == email);
        if (!isInvitee)
        {
            return Failure<bool>("Forbidden", StatusCodes.Status403Forbidden);
        }

        invitation.Status = ProjectInvitationStatus.Declined;
        invitation.RespondedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        return OperationResult<bool>.Success(true);
    }

    private static OperationResult<T> Failure<T>(string message, int status)
    {
        return OperationResult<T>.Failure(new OperationError(message, status));
    }

    private static bool IsOwner(Project project, string userId)
    {
        return project.OwnerId == userId || project.Members.Any(m => m.UserId == userId && m.Role == ProjectRole.Owner);
    }

    private static bool IsMember(Project project, string userId)
    {
        return project.Members.Any(m => m.UserId == userId);
    }
}
