"""add_agencies_table

Revision ID: c7a1f4e92b3d
Revises: b5e06d669e61
Create Date: 2026-07-15 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7a1f4e92b3d'
down_revision: Union[str, None] = 'b5e06d669e61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('agencies',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('code', sa.String(length=100), nullable=False),
    sa.Column('display_name', sa.String(length=255), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
    sa.Column('thu_tuc_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
    sa.Column('crawl_status', sa.String(length=20), nullable=False, server_default=sa.text("'idle'")),
    sa.Column('last_crawled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_crawl_error', sa.Text(), nullable=True),
    sa.Column('source_excel', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code')
    )
    op.create_index(op.f('ix_agencies_code'), 'agencies', ['code'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_agencies_code'), table_name='agencies')
    op.drop_table('agencies')
