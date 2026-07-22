"""week 2 streaming, external experiments, and comparison history

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# create_type=False — see the comment on the enums in 0001_initial_schema.py;
# the explicit .create() call below already handles creation.
experiment_type = postgresql.ENUM("builtin", "external", name="experiment_type", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    experiment_type.create(bind, checkfirst=True)
    op.add_column(
        "experiments",
        sa.Column("type", experiment_type, nullable=False, server_default="builtin"),
    )
    op.add_column("experiments", sa.Column("endpoint_url", sa.Text(), nullable=True))
    op.add_column("experiments", sa.Column("auth_header", sa.Text(), nullable=True))
    op.alter_column("experiments", "type", server_default=None)

    op.create_table(
        "comparison_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_name", sa.String(), nullable=False),
        sa.Column(
            "comparison_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("comparisons.id"),
            nullable=False,
        ),
        sa.Column(
            "baseline_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("runs.id"), nullable=False
        ),
        sa.Column(
            "candidate_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("runs.id"), nullable=False
        ),
        sa.Column("verdict", sa.String(), nullable=False),
        sa.Column("metrics_improved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metrics_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_comparison_history_project_name", "comparison_history", ["project_name"])


def downgrade() -> None:
    op.drop_index("ix_comparison_history_project_name", table_name="comparison_history")
    op.drop_table("comparison_history")
    op.drop_column("experiments", "auth_header")
    op.drop_column("experiments", "endpoint_url")
    op.drop_column("experiments", "type")
    experiment_type.drop(op.get_bind(), checkfirst=True)
