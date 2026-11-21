from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'd4e9f2a8c6b1'
down_revision: str | None = 'c2d8e5f7a1b4'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'report_schedules',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('user_id', sa.String(length=32), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('scope', sa.String(length=255), nullable=False),
        sa.Column('kind', sa.String(length=32), nullable=False),
        sa.Column('repository_id', sa.String(length=32), nullable=True),
        sa.Column('interval_hours', sa.Integer(), nullable=False),
        sa.Column('next_run_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['repository_id'], ['repositories.id'], name=op.f('fk_report_schedules_repository_id_repositories'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_report_schedules_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_report_schedules')),
    )
    op.create_index(op.f('ix_report_schedules_next_run_at'), 'report_schedules', ['next_run_at'], unique=False)
    op.create_index(op.f('ix_report_schedules_user_id'), 'report_schedules', ['user_id'], unique=False)
    op.create_table(
        'intel_filters',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('user_id', sa.String(length=32), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('query', sa.String(length=255), nullable=False),
        sa.Column('severity', sa.String(length=24), nullable=True),
        sa.Column('exploited', sa.Boolean(), nullable=True),
        sa.Column('sort', sa.String(length=24), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_intel_filters_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_intel_filters')),
    )
    op.create_index(op.f('ix_intel_filters_user_id'), 'intel_filters', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_intel_filters_user_id'), table_name='intel_filters')
    op.drop_table('intel_filters')
    op.drop_index(op.f('ix_report_schedules_user_id'), table_name='report_schedules')
    op.drop_index(op.f('ix_report_schedules_next_run_at'), table_name='report_schedules')
    op.drop_table('report_schedules')
