"""MongoDB collection names for read models."""

ARTICLES_COLLECTION = "articles"
MEDIA_COLLECTION = "media"
USERS_COLLECTION = "users"
CATEGORIES_COLLECTION = "categories"
MARKETS_COLLECTION = "markets"
LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"
SPORTS_PAGE_SECTIONS_COLLECTION = "sports_page_sections"
GOVERNMENT_PAGE_SECTIONS_COLLECTION = "government_page_sections"
ENTERTAINMENT_PAGE_SECTIONS_COLLECTION = "entertainment_page_sections"
HEALTH_PAGE_SECTIONS_COLLECTION = "health_page_sections"
CUSTOM_TABS_COLLECTION = "custom_tabs"
CUSTOM_PAGE_SECTIONS_COLLECTION = "custom_page_sections"
HOMEPAGE_PAGE_SECTIONS_COLLECTION = "homepage_page_sections"
WORLD_PAGE_SECTIONS_COLLECTION = "world_page_sections"
WIDGETS_COLLECTION = "widgets"
# Append-only log of when an article was pinned into a slot, used to badge
# newly placed stories on the editorial workflow tabs.
PLACEMENT_EVENTS_COLLECTION = "placement_events"
# Per-user last-seen timestamp for each workflow view (placement, review).
USER_VIEW_STATE_COLLECTION = "user_view_state"
