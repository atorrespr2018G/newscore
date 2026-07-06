"""Request/response schemas shared across services."""

from shared.schemas.article_schemas import ArticleCreate, ArticleDetailOut, ArticleOut, ArticleUpdate
from shared.schemas.category_schemas import CategoryCreate, CategoryOut, CategoryUpdate
from shared.schemas.layout_schemas import (
    LayoutCreate,
    LayoutOut,
    LayoutUpdate,
    SlotCreate,
    SlotOut,
    SlotUpdate,
)
from shared.schemas.media_schemas import MediaOut
from shared.schemas.region_schemas import RegionCreate, RegionMove, RegionOut, RegionUpdate
from shared.schemas.user_schemas import (
    LoginRequest,
    ReporterBioUpdate,
    TokenResponse,
    UserCreate,
    UserOut,
    UserUpdate,
)

__all__ = [
    "ArticleCreate",
    "ArticleDetailOut",
    "ArticleOut",
    "ArticleUpdate",
    "CategoryCreate",
    "CategoryOut",
    "CategoryUpdate",
    "LayoutCreate",
    "LayoutOut",
    "LayoutUpdate",
    "SlotCreate",
    "SlotOut",
    "SlotUpdate",
    "MediaOut",
    "RegionCreate",
    "RegionMove",
    "RegionOut",
    "RegionUpdate",
    "LoginRequest",
    "ReporterBioUpdate",
    "TokenResponse",
    "UserCreate",
    "UserOut",
    "UserUpdate",
]

