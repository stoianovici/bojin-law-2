# Navigation Pattern

> Extracted from: home-desktop.html, tasks-page.html, documents-page.html, calendar-page.html

## Status Toggle

Button group for switching between status views.

```
Background: var(--bg-tertiary)
Border: 1px solid var(--border-subtle)
Border-radius: 8px
Overflow: hidden
```

### Structure

```html
<div class="status-toggle">
  <button class="status-btn active">Ciornă</button>
  <button class="status-btn">Review <span class="status-badge review">3</span></button>
  <button class="status-btn">Final <span class="status-badge final">2</span></button>
</div>
```

### Styling

```css
.status-toggle {
  display: flex;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  overflow: hidden;
}

.status-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.status-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.status-btn.active {
  background: var(--accent-secondary);
  color: var(--accent-primary);
}

.status-btn + .status-btn {
  border-left: 1px solid var(--border-subtle);
}
```

---

## View Toggle

Icon-only button group for switching views (Grid/List, etc.)

### Structure

```html
<div class="view-toggle">
  <button class="view-btn active" title="Grid">
    <svg><!-- grid icon --></svg>
  </button>
  <button class="view-btn" title="List">
    <svg><!-- list icon --></svg>
  </button>
</div>
```

### Styling

```css
.view-toggle {
  display: flex;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  overflow: hidden;
}

.view-btn {
  padding: 8px 10px;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
}

.view-btn:hover {
  color: var(--text-secondary);
}

.view-btn.active {
  background: var(--bg-hover);
  color: var(--text-primary);
}
```

### Variants

| Page      | Options                    |
| --------- | -------------------------- |
| Documents | Grid \| List               |
| Tasks     | List \| Kanban \| Calendar |

---

## Tab Bar (Within Page)

For switching tabs within a content area.

### Structure

```html
<div class="tab-bar">
  <button class="tab active">Tab 1</button>
  <button class="tab">Tab 2</button>
  <button class="tab">Tab 3</button>
</div>
```

### Styling

```css
.tab-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 16px;
}

.tab {
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  position: relative;
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--text-primary);
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent-primary);
}
```

---

## Sidebar Navigation

Main app navigation in left sidebar.

### Structure

```
┌─────────────────────────┐
│ [Logo] Bojin Law        │
├─────────────────────────┤
│ PRINCIPAL               │
│ ├─ Tablou de Bord       │
│ ├─ Cazuri          [3]  │
│ ├─ Sarcini              │
│ ├─ Documente            │
│ ├─ Calendar             │
│ └─ Comunicări           │
│                         │
│ MANAGEMENT              │
│ ├─ Analiză              │
│ ├─ Pontaj               │
│ └─ Activitate Echipă    │
├─────────────────────────┤
│ [AB] Alexandru Bojin    │
│      Partener           │
└─────────────────────────┘
```

### Section Title

```css
.nav-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
  padding: 8px 12px;
}
```

### Nav Item

```css
.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--accent-secondary);
  color: var(--accent-primary);
}

.nav-item-icon {
  width: 18px;
  height: 18px;
  opacity: 0.7;
}

.nav-item.active .nav-item-icon {
  opacity: 1;
}
```

### Nav Badge

```css
.nav-badge {
  margin-left: auto;
  background: var(--status-error-bg);
  color: var(--status-error);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
}
```

---

## Breadcrumbs

Navigation path for nested pages.

### Structure

```html
<nav class="breadcrumb">
  <a href="#">Cazuri</a>
  <span class="breadcrumb-separator">›</span>
  <a href="#">Ionescu vs. Alpha SRL</a>
  <span class="breadcrumb-separator">›</span>
  <span class="current">Toate documentele</span>
</nav>
```

### Styling

```css
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-tertiary);
}

.breadcrumb a {
  color: var(--text-tertiary);
  text-decoration: none;
}

.breadcrumb a:hover {
  color: var(--text-primary);
}

.breadcrumb .current {
  color: var(--text-primary);
  font-weight: 500;
}

.breadcrumb-separator {
  color: var(--text-muted);
}
```
