from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'c2d8e5f7a1b4'
down_revision: str | None = 'b7c1d9e4a3f2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('scans', sa.Column('progress', sa.Integer(), server_default='0', nullable=False))
    op.add_column('scans', sa.Column('stage', sa.String(length=32), server_default='queued', nullable=False))
    op.add_column('scans', sa.Column('message', sa.String(length=255), server_default='', nullable=False))


def downgrade() -> None:
    op.drop_column('scans', 'message')
    op.drop_column('scans', 'stage')
    op.drop_column('scans', 'progress')
