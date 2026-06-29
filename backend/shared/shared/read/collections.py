"""MongoDB collection names for read models."""

ARTICLES_COLLECTION = "articles"
MEDIA_COLLECTION = "media"
USERS_COLLECTION = "users"
CATEGORIES_COLLECTION = "categories"
MARKETS_COLLECTION = "markets"
LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"
WIDGETS_COLLECTION = "widgets"
# Append-only log of when an article was pinned into a slot, used to badge
# newly placed stories on the editorial workflow tabs.
PLACEMENT_EVENTS_COLLECTION = "placement_events"
# Per-user last-seen timestamp for each workflow view (placement, review).
USER_VIEW_STATE_COLLECTION = "user_view_state"
