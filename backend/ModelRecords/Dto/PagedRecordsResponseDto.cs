namespace backend.ModelRecord.Dto;

public record PagedRecordsResponseDto(
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    List<ModelRecordResponseDto> Items
);
