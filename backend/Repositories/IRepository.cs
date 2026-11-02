using System.Linq.Expressions;

namespace backend.Repository;

public interface IRepository<T> where T : class
{
    Task<T> AddAsync(T entity);
    Task<IEnumerable<T>> FindAllAsync(Expression<Func<T, bool>> predicate);
    Task<T?> FindAsync(Expression<Func<T, bool>> predicate);
    Task<int> DeleteWhereAsync(Expression<Func<T, bool>> predicate);
}
