# Story 01: Design Tokens

**Parallelizable with**: All other Phase 1 stories
**Depends on**: Nothing
**Blocks**: None (other components can use tokens after)

---

## Task: Extend Linear Design Tokens

**File**: `src/app/globals.css` (MODIFY)

### Do

Add missing Linear design tokens to the existing CSS custom properties:

1. **Spacing scale** (add after existing color tokens):

```css
--linear-space-xs: 4px;
--linear-space-sm: 8px;
--linear-space-md: 12px;
--linear-space-lg: 16px;
--linear-space-xl: 24px;
--linear-space-2xl: 32px;
```

2. **Typography scale**:

```css
--linear-text-xs: 11px;
--linear-text-sm: 12px;
--linear-text-base: 13px;
--linear-text-lg: 14px;
--linear-text-xl: 16px;
--linear-text-2xl: 20px;

--linear-leading-tight: 1.25;
--linear-leading-normal: 1.5;
--linear-leading-relaxed: 1.625;
```

3. **Border radius**:

```css
--linear-radius-sm: 4px;
--linear-radius-md: 6px;
--linear-radius-lg: 8px;
--linear-radius-xl: 12px;
--linear-radius-full: 9999px;
```

4. **Shadows** (dark theme appropriate):

```css
--linear-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
--linear-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4);
--linear-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5);
```

5. **Z-index scale**:

```css
--linear-z-dropdown: 50;
--linear-z-sticky: 60;
--linear-z-modal: 100;
--linear-z-popover: 110;
--linear-z-tooltip: 150;
```

6. **Update Tailwind utilities** in `tailwind.config.js` if needed to expose these as classes.

### Done when

- All tokens defined in `:root`
- Tokens documented with section comments
- No duplicate variable names
- Build passes (`pnpm build`)
