import enum
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy import DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncAttrs, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://benchx:benchx@localhost:5432/benchx",
)

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(AsyncAttrs, DeclarativeBase):
    pass


class ExperimentStatus(str, enum.Enum):
    configured = "configured"
    running = "running"
    completed = "completed"
    failed = "failed"


class RunStatus(str, enum.Enum):
    running = "running"
    completed = "completed"
    failed = "failed"


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    temperature: Mapped[float] = mapped_column(Float, nullable=False)
    max_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    system_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    chunk_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    top_k: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    extra_params: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[ExperimentStatus] = mapped_column(
        SAEnum(ExperimentStatus, name="experiment_status"),
        nullable=False,
        default=ExperimentStatus.configured,
    )

    runs: Mapped[list["Run"]] = relationship(back_populates="experiment", cascade="all, delete-orphan")


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    questions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    runs: Mapped[list["Run"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    experiment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("experiments.id"), nullable=False)
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[RunStatus] = mapped_column(
        SAEnum(RunStatus, name="run_status"),
        nullable=False,
        default=RunStatus.running,
    )
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_questions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    experiment: Mapped["Experiment"] = relationship(back_populates="runs")
    dataset: Mapped["Dataset"] = relationship(back_populates="runs")
    results: Mapped[list["Result"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class Result(Base):
    __tablename__ = "results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("runs.id"), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    ground_truth: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False)
    cost_usd: Mapped[float] = mapped_column(Float, nullable=False)
    relevancy_score: Mapped[float] = mapped_column(Float, nullable=False)
    hallucination_score: Mapped[float] = mapped_column(Float, nullable=False)
    hallucination_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tokens_input: Mapped[int] = mapped_column(Integer, nullable=False)
    tokens_output: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    run: Mapped["Run"] = relationship(back_populates="results")


class Comparison(Base):
    __tablename__ = "comparisons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    run_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    summary: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


async def get_session():
    async with async_session() as session:
        yield session
