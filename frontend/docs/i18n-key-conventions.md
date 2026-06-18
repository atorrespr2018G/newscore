# i18n key conventions

Platform UI copy lives in `frontend/messages/{locale}/*.json` and is loaded through `next-intl`.

## Namespaces

| Namespace | Owns |
|-----------|------|
| `common` | Shared chrome: loading/error states, ads, footer, breadcrumbs, dates |
| `navigation` | Masthead, section labels, market/language selectors |
| `home` | Homepage-specific UI such as article ad modules |
| `auth` | Sign-in and authentication labels |

## Key rules

- Use stable semantic keys (`navigation.sectionLabels.world`), never English source strings as keys.
- Prefer nested objects for grouped UI (`footerCompany.about`).
- Add a key to every enabled locale when introducing new copy.

## Do not translate

Keep CMS and API payload fields in their original language:

- `article.title`, `article.summary`, `article.body`
- `article.authorName` when supplied by editorial systems
- Breaking ticker text and slot `displayName` values from the feed API

GraphQL schema and operations must not be changed for UI localization.

## Adding a language

1. Add the locale code to `frontend/i18n/config.ts`.
2. Register it in `frontend/lib/i18n/language-registry.ts`.
3. Copy namespace JSON files under `frontend/messages/{locale}/`.
4. Run `npm run validate-i18n`.
