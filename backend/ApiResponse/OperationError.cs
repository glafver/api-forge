namespace backend.ApiResponse.OperationResults;

public sealed record OperationError(string Message, int Status);