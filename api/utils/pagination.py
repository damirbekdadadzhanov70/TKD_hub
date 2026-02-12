from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def paginate_query(
    session: AsyncSession,
    query: Select,
    page: int,
    limit: int,
) -> tuple[list, int]:
    """Execute a paginated query, returning (rows, total_count)."""
    # Count total rows matching the base query (without offset/limit)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar() or 0

    # Apply pagination
    paginated = query.offset((page - 1) * limit).limit(limit)
    result = await session.execute(paginated)
    rows = result.scalars().all()

    return rows, total
