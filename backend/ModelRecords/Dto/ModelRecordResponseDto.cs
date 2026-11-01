namespace backend.ModelRecord.Dto;

public record ModelRecordResponseDto(Guid Id, List<RecordFieldDto> Fields);
