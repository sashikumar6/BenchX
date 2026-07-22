"""rag pipeline: corpora, documents, chunks (pgvector)

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql


revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "corpora",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("corpus_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("corpora.id"), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("corpus_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("corpora.id"), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("chunk_size", sa.Integer(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "corpus_id", "chunk_size", "document_id", "chunk_index",
            name="uq_chunks_corpus_chunksize_doc_index",
        ),
    )
    op.create_index("ix_chunks_corpus_chunksize", "chunks", ["corpus_id", "chunk_size"])
    op.execute(
        "CREATE INDEX ix_chunks_embedding_hnsw ON chunks USING hnsw (embedding vector_cosine_ops)"
    )

    op.add_column(
        "experiments",
        sa.Column("corpus_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("corpora.id"), nullable=True),
    )
    op.add_column(
        "results",
        sa.Column("retrieved_chunk_ids", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("results", "retrieved_chunk_ids")
    op.drop_column("experiments", "corpus_id")
    op.execute("DROP INDEX IF EXISTS ix_chunks_embedding_hnsw")
    op.drop_index("ix_chunks_corpus_chunksize", table_name="chunks")
    op.drop_table("chunks")
    op.drop_table("documents")
    op.drop_table("corpora")
    op.execute("DROP EXTENSION IF EXISTS vector")
