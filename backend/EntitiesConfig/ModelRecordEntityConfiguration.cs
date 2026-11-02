using backend.ModelRecord.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.EntitiesConfig;

public class ModelRecordEntityConfiguration : IEntityTypeConfiguration<ModelRecordEntity>
{
    public void Configure(EntityTypeBuilder<ModelRecordEntity> builder)
    {
        builder.Navigation(m => m.Model).AutoInclude();
        builder.Navigation(m => m.Values).AutoInclude();
    }
}