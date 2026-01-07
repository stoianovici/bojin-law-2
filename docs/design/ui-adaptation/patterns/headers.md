# Page Headers Pattern

> Extracted from: home-desktop.html, tasks-page.html, documents-page.html

## Sticky Header

Standard page header with blur backdrop.

```css
.header {
  position: sticky;
  top: 0;
  background: rgba(10, 10, 11, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-subtle);
  padding: 16px 24px;
  z-index: 50;
}
```

---

## Header Layouts

### Dashboard Header (Simple)

```
┌─────────────────────────────────────────────────────────────┐
│ Tablou de Bord              [Search ⌘K] [🔔] [?]           │
└─────────────────────────────────────────────────────────────┘
```

```css
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
```

### Page Header with Toolbar (Full)

```
┌─────────────────────────────────────────────────────────────┐
│ Sarcini                           [List|Kanban] [+ Sarcină]│
├─────────────────────────────────────────────────────────────┤
│ [🔍 Caută...] [Sarcinile mele] [Filtre] [Caz] [Scadență]   │
└─────────────────────────────────────────────────────────────┘
```

```css
.page-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
}

.page-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
```

### Page Header with Breadcrumbs (Documents)

```
┌─────────────────────────────────────────────────────────────┐
│ Cazuri › Ionescu vs. Alpha SRL › Toate documentele          │
├─────────────────────────────────────────────────────────────┤
│ [🔍] [Ciornă|Review|Final]        ----        [Grid] [Încarcă]│
└─────────────────────────────────────────────────────────────┘
```

```css
.content-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  position: sticky;
  top: 0;
  z-index: 10;
}

.breadcrumb {
  margin-bottom: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-spacer {
  flex: 1;
}
```

---

## Page Title

```css
.page-title {
  font-size: 16px; /* dashboard */
  /* or */
  font-size: 20px; /* full page */
  font-weight: 600;
  color: var(--text-primary);
}
```

---

## Filter Bar

Row of filter controls below page title.

```css
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}
```

Components in filter bar:

1. Search input (fixed width ~200px)
2. Toggle filters (e.g., "Sarcinile mele")
3. Dropdown filters (Caz, Scadență, etc.)
4. Spacer (flex: 1)
5. View toggles
6. Primary action button

---

## Search in Header

Compact search with keyboard shortcut hint.

```html
<div class="search-box">
  <svg><!-- search icon --></svg>
  <input type="text" placeholder="Caută cazuri, clienți..." />
  <span class="search-shortcut">⌘K</span>
</div>
```

```css
.search-box {
  width: 240px;
}
```

---

## Notification Button

Icon button with badge indicator.

```html
<button class="icon-btn">
  <svg><!-- bell icon --></svg>
  <span class="badge"></span>
</button>
```

```css
.icon-btn .badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  background: var(--status-error);
  border-radius: 50%;
  border: 2px solid var(--bg-primary);
}
```
