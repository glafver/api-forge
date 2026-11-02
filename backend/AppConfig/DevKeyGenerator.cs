using System.Security.Cryptography;
using System.Text;

namespace backend.AppConfig;

public static class DevKeyGenerator
{
    private static string Salt =>
        Environment.GetEnvironmentVariable("DEV_KEY_SALT") ?? "ApiForgeDevSalt";

    public static string Generate(Guid projectId, DateTime date)
    {
        var input = $"{projectId:N}:{date:yyyyMMdd}:{Salt}";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        var value = BitConverter.ToUInt64(hash, 0);
        return (value % 1_000_000_000).ToString("D9");
    }

    public static bool IsValid(string key, Guid projectId, DateTime date)
    {
        return string.Equals(key, Generate(projectId, date), StringComparison.Ordinal);
    }
}
