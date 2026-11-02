using System.Linq.Expressions;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Repository;

public class Repository<T> : IRepository<T> where T : class
{
    private readonly ApplicationDBContext dbContext;
    private readonly DbSet<T> dbSet;

    public Repository(ApplicationDBContext dbContext)
    {
        this.dbContext = dbContext;
        this.dbSet = dbContext.Set<T>();
    }

    public async Task<T> AddAsync(T entity)
    {
        await dbSet.AddAsync(entity);
        await dbContext.SaveChangesAsync();
        return entity;
    }

    public async Task<IEnumerable<T>> FindAllAsync(Expression<Func<T, bool>> predicate)
    {
        return await dbSet.Where(predicate).ToListAsync();
    }

    public async Task<T?> FindAsync(Expression<Func<T, bool>> predicate)
    {
        return await dbSet.Where(predicate).FirstOrDefaultAsync();
    }

    public async Task<int> DeleteWhereAsync(Expression<Func<T, bool>> predicate)
    {
        return await dbSet.Where(predicate).ExecuteDeleteAsync();
    }
}
