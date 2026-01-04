# Forms & Inputs Pattern

> Extracted from: home-desktop.html, tasks-page.html, documents-page.html

## Search Box

Search input with icon and optional keyboard shortcut hint.

```
Background: var(--bg-tertiary)
Border: 1px solid var(--border-subtle)
Border-radius: 8px
Padding: 8px 12px
```

**Focus State:**

```css
.search-box:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-secondary);
}
```

### Structure

```html
<div class="search-box">
  <svg><!-- search icon --></svg>
  <input type="text" placeholder="Caută..." />
  <span class="search-shortcut">⌘K</span>
</div>
```

### Styling

```css
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 8px 12px;
  width: 200-240px;
}

.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 13px;
}

.search-box input::placeholder {
  color: var(--text-tertiary);
}

.search-shortcut {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
}
```

---

## Buttons

### Primary Button

```css
.btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--accent-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--accent-primary-hover);
}
```

### Secondary Button

```css
.btn-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}
```

### Icon Button

```css
.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
```

### Small Action Button

For inline actions (document cards, etc.)

```css
.action-btn {
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  color: var(--text-tertiary);
  font-size: 11px;
  cursor: pointer;
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-default);
}
```

---

## Filter Button

Toggle-style filter with icon.

```css
.filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.filter-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.filter-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}
```

---

## Textarea

For comments and longer text input.

```css
.comment-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  resize: none;
  font-family: inherit;
}

.comment-input::placeholder {
  color: var(--text-muted);
}

.comment-input:focus {
  outline: none;
  border-color: var(--accent);
}
```

---

## Checkbox

Used in task lists and subtasks.

### Task Checkbox (18px)

```css
.task-checkbox {
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--border-default);
  border-radius: 4px;
  flex-shrink: 0;
  cursor: pointer;
}

.task-checkbox:hover {
  border-color: var(--accent);
}

.task-checkbox.checked {
  background: var(--status-done);
  border-color: var(--status-done);
}
```

### Subtask Checkbox (16px)

```css
.subtask-checkbox {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--border-default);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.subtask-checkbox.checked {
  background: var(--accent);
  border-color: var(--accent);
}

.subtask-checkbox.checked svg {
  display: block;
  width: 10px;
  height: 10px;
  color: white;
}
```

---

## Form Field Guidelines

| Property      | Value                             |
| ------------- | --------------------------------- |
| Font size     | 13px                              |
| Border radius | 6-8px                             |
| Padding       | 8px 12px                          |
| Border        | 1px solid var(--border-subtle)    |
| Background    | var(--bg-tertiary)                |
| Focus ring    | 0 0 0 3px var(--accent-secondary) |
| Placeholder   | var(--text-tertiary)              |
