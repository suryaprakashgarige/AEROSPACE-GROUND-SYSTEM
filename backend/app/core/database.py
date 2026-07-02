# backend/app/core/database.py
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from backend.app.core.config import settings

from sqlalchemy.pool import StaticPool

connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
poolclass = StaticPool if "sqlite" in settings.DATABASE_URL else None

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=not ("sqlite" in settings.DATABASE_URL),
    echo=False,
    connect_args=connect_args,
    poolclass=poolclass
)

# Async session maker
async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
