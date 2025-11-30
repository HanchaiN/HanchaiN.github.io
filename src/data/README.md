# Data-Driven Pages

This directory contains the data structure for generating pages and navigation dynamically.

## Structure

### `pages.json`

This file contains all the configuration for:

- **Navigation bar** (`navbar`): Site navigation structure including brand, menu items, and dropdowns
- **Categories** (`categories`): Project categories with their metadata and project listings
- **Home page** (`home`): Content for the home page including hero section, highlights, and about section

## How It Works

1. **Build Process**: The `PagesBuilder` in `src/bin/builders/pages-builder.js` loads `pages.json` and passes it to Pug templates as `pagesData`.

2. **Pug Mixins**: Reusable mixins in `src/components/mixins.pug` render navigation and project cards from the data.

3. **Templates**: Page templates access the data via `pagesData` variable (e.g., `pagesData.navbar`, `pagesData.categories`, `pagesData.home`).

## Adding New Pages

To add a new page or project:

1. Add the entry to the appropriate section in `pages.json`:
   - For navigation: add to `navbar.items[].dropdown[].children[]`
   - For project listings: add to `categories[].projects[]`
   - For home page features: update the `home` section

2. The changes will automatically be reflected when you rebuild the pages.

## Benefits

- **Single Source of Truth**: All page and navigation data in one place
- **Easy Maintenance**: Update content without touching template files
- **Consistency**: Ensures navigation and page lists stay in sync
- **Scalability**: Easy to add new pages or reorganize structure

## Example: Adding a New Project

```json
{
  "categories": [
    {
      "id": "simulation",
      "projects": [
        {
          "title": "New Simulation",
          "description": "Description of the new simulation.",
          "href": "/creative_coding/simulation/new_simulation"
        }
      ]
    }
  ]
}
```

Then add the corresponding entry to the navbar dropdown if needed.
