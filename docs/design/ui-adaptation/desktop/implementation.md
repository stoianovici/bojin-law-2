# Desktop Implementation Checklist

> Use this checklist when implementing desktop UI. Check off items as completed.

## 1. Foundation Setup

### Design Tokens

- [ ] Add Linear tokens to `tailwind.config.js`
  - [ ] Background colors (`bg-primary` → `#0A0A0B`, etc.)
  - [ ] Border colors (`border-subtle`, `border-default`, `border-strong`)
  - [ ] Text colors (`text-primary` → `#EEEFF1`, etc.)
  - [ ] Accent colors (`accent` → `#5E6AD2`, etc.)
  - [ ] Status colors (success, warning, error, info)
  - [ ] Priority colors (urgent, high, medium, low)

- [ ] Set up typography scale

  ```js
  fontSize: {
    'xs': '11px',    // badges, shortcuts
    'sm': '12px',    // metadata, captions
    'base': '13px',  // body, nav, buttons
    'md': '14px',    // inputs, cards
    'lg': '15px',    // subheadings
    'xl': '16px',    // form titles
    '2xl': '18px',   // modal headings
    '3xl': '20px',   // page headings
    '4xl': '24px',   // dashboard stats
  }
  ```

- [ ] Configure shadows
  - [ ] `shadow-sm`: subtle button elevation
  - [ ] `shadow-md`: card hover
  - [ ] `shadow-lg`: modals, dropdowns
  - [ ] `shadow-glow`: accent glow effect

### Layout Components

- [ ] Create `AppLayout` component
  - [ ] Fixed 240px sidebar
  - [ ] Main content area with `bg-primary`
  - [ ] Max content width (1200px)

- [ ] Create `Sidebar` component
  - [ ] Logo section (Bojin Law + icon)
  - [ ] Nav sections (Principal, Management)
  - [ ] Nav items with icons
  - [ ] Active state styling
  - [ ] Badge support for counts
  - [ ] User menu at bottom (avatar + name + role)

- [ ] Create `PageLayout` component
  - [ ] Page header slot
  - [ ] Content area with proper padding
  - [ ] Optional toolbar slot

- [ ] Create `PageHeader` component
  - [ ] Title + optional icon
  - [ ] Breadcrumbs support
  - [ ] Action buttons slot
  - [ ] Toolbar slot (filters, search, view toggle)

---

## 2. Core Components

### Buttons

- [ ] Create `Button` component
  - [ ] Variants: primary, secondary, ghost, danger
  - [ ] Sizes: sm (`8px 14px`), md (`10px 16px`)
  - [ ] Icon support (left, right, icon-only)
  - [ ] Loading state with spinner

- [ ] Create `IconButton` component
  - [ ] 36×36px default size
  - [ ] Hover background

- [ ] Create `ActionButton` component (small inline actions)
  - [ ] 4px 8px padding
  - [ ] 11px font size
  - [ ] For document cards, table rows

### Form Inputs

- [ ] Create `Input` component
  - [ ] Background: `bg-tertiary`
  - [ ] Border: 1px `border-subtle`
  - [ ] Focus: accent border + 3px glow
  - [ ] Placeholder: `text-tertiary`
  - [ ] 13px font, 8px 12px padding

- [ ] Create `SearchBox` component
  - [ ] Search icon prefix
  - [ ] Keyboard shortcut hint (⌘K)
  - [ ] 200-240px width

- [ ] Create `Select` component
  - [ ] Custom dropdown styling
  - [ ] Chevron icon
  - [ ] Option hover states

- [ ] Create `Checkbox` component
  - [ ] 18px size (tasks)
  - [ ] 16px size (subtasks)
  - [ ] Accent color when checked
  - [ ] Green for completed tasks

- [ ] Create `Textarea` component
  - [ ] Same styling as Input
  - [ ] Auto-resize option

### Cards

- [ ] Create `Card` component
  - [ ] Background: `bg-secondary`
  - [ ] Border: 1px `border-subtle`
  - [ ] Border-radius: 12px
  - [ ] Hover: stronger border + shadow

- [ ] Create `CardHeader` component
  - [ ] Icon + title + action buttons
  - [ ] 16px 20px padding
  - [ ] Bottom border

- [ ] Create `CardBody` component
  - [ ] 16px 20px padding

- [ ] Create `BriefingCard` component
  - [ ] Accent gradient top border
  - [ ] Greeting text
  - [ ] Summary text
  - [ ] Stats row (4 items)

### Status Indicators

- [ ] Create `StatusDot` component
  - [ ] Colors: green (active), yellow (pending), red (at-risk)
  - [ ] Optional glow for active
  - [ ] Optional pulse animation for urgent

- [ ] Create `PriorityBadge` component
  - [ ] Urgent: red bg + text
  - [ ] High: orange bg + text
  - [ ] Medium: blue bg + text
  - [ ] Low: gray/muted

- [ ] Create `StatusBadge` component
  - [ ] Generic status pill
  - [ ] Color variants (success, warning, error, info)

### Navigation

- [ ] Create `StatusToggle` component
  - [ ] Button group for status filtering
  - [ ] Active state with accent background
  - [ ] Optional count badges

- [ ] Create `ViewToggle` component
  - [ ] Icon-only button group
  - [ ] Grid/List variants
  - [ ] Active state

- [ ] Create `TabBar` component
  - [ ] Underline active indicator
  - [ ] Badge support
  - [ ] Horizontal scrollable for many tabs

- [ ] Create `Breadcrumb` component
  - [ ] Link items with separator
  - [ ] Current item (not a link)

- [ ] Create `FilterPills` component
  - [ ] Horizontal scrollable
  - [ ] Active/inactive states
  - [ ] Remove button option

### Lists & Tables

- [ ] Create `CollapsibleSection` component
  - [ ] Header with toggle icon
  - [ ] Count badge
  - [ ] Smooth expand/collapse animation

- [ ] Create `TaskItem` component
  - [ ] Checkbox + priority bar
  - [ ] Title + meta row
  - [ ] Case link + due date
  - [ ] Hover state
  - [ ] Completed state (strikethrough)

- [ ] Create `CaseItem` component
  - [ ] Case number (accent, mono font)
  - [ ] Title + client
  - [ ] Status dot

- [ ] Create `DocumentCard` component
  - [ ] Thumbnail with type badge
  - [ ] File info (name, size)
  - [ ] Action buttons (folder, open in Word)
  - [ ] Selected state (dashed border)

- [ ] Create `MinimalTable` component
  - [ ] Light header (no background)
  - [ ] Row hover states
  - [ ] Title + subtitle in first column

- [ ] Create `GroupedTable` component
  - [ ] Collapsible group headers
  - [ ] Count in header
  - [ ] Date-based grouping

---

## 3. Modals & Dialogs

### Modal System

- [ ] Create `ModalBackdrop` component
  - [ ] 80% opacity black
  - [ ] Blur backdrop filter
  - [ ] Click to close

- [ ] Create `ConfirmDialog` component
  - [ ] 400px width
  - [ ] Icon (colored by severity)
  - [ ] Title + description
  - [ ] Cancel + action buttons

- [ ] Create `FormModal` component
  - [ ] 520px width
  - [ ] Header with title + close
  - [ ] Scrollable body
  - [ ] Footer with hint + actions
  - [ ] ⌘Enter to submit

- [ ] Create `SlideOver` component
  - [ ] 400px width, right edge
  - [ ] Header + scrollable body + footer
  - [ ] Slide-in animation

- [ ] Create `CommandPalette` component
  - [ ] 520px width, top center
  - [ ] Search input
  - [ ] Grouped action items
  - [ ] Keyboard navigation (↑↓Enter)
  - [ ] ⌘K trigger

- [ ] Create `Toast` component
  - [ ] 380px width, bottom right
  - [ ] Icon + title + message
  - [ ] Success/error/warning/info variants
  - [ ] Auto-dismiss (5s)
  - [ ] Stack multiple toasts

---

## 4. Page Implementations

### Home / Dashboard (`/`)

- [ ] Create `Dashboard` page
  - [ ] Morning briefing card (greeting + summary + 4 stats)
  - [ ] 3-column CSS grid for widgets
  - [ ] Skeleton loading states

- [ ] Create `SupervisedCasesWidget`
  - [ ] Card header with icon + "Cazuri Supravegheate"
  - [ ] Case item list (case#, title, client, status dot)
  - [ ] "Vezi toate" action

- [ ] Create `MyTasksWidget`
  - [ ] Card header with icon + "Sarcinile Mele"
  - [ ] Task items with checkbox, title, priority, due
  - [ ] Complete task on checkbox click

- [ ] Create `FirmMetricsWidget`
  - [ ] 2×2 grid of metric cards
  - [ ] Value + label + trend indicator

- [ ] Create `TeamWorkloadWidget` (spans 2 cols)
  - [ ] Team member rows
  - [ ] Avatar + name + workload bar
  - [ ] Percentage + hours

### Cases (`/cases`)

- [ ] Create `CasesListPage`
  - [ ] Page header with title + "Caz nou" button
  - [ ] Search box + filter dropdown + status toggle
  - [ ] Minimal table with sortable columns
  - [ ] Case number (accent mono), title, client, status dot, assigned
  - [ ] Row click → case detail

- [ ] Create `NewCaseModal`
  - [ ] Form modal pattern
  - [ ] Title input (larger)
  - [ ] Client selector (combobox)
  - [ ] Case type dropdown
  - [ ] Description textarea
  - [ ] Assign to team member
  - [ ] Create button

### Case Detail (`/cases/[id]`)

- [ ] Create `CaseDetailPage`
  - [ ] Breadcrumb (Cazuri > Case Title)
  - [ ] Case header (title, case#, status, client)
  - [ ] Tab bar (Detalii, Documente, Timp, Mesaje, Activitate)

- [ ] Create `CaseDetailsTab`
  - [ ] Two-column layout
  - [ ] Case info section (type, court, file number)
  - [ ] Client info section
  - [ ] Assigned team section (avatars)
  - [ ] Key dates section

- [ ] Create `CaseDocumentsTab`
  - [ ] Status toggle (Ciornă, Review, Final)
  - [ ] View toggle (Grid/List)
  - [ ] Document grid or table
  - [ ] Upload button

- [ ] Create `CaseTimeEntriesTab`
  - [ ] Grouped table by date
  - [ ] Add time entry button
  - [ ] Entry rows (date, user, description, hours, billable)

- [ ] Create `CaseMessagesTab`
  - [ ] Message thread list
  - [ ] Reply composer

- [ ] Create `CaseActivityTab`
  - [ ] Activity timeline
  - [ ] Filter by type

### Tasks (`/tasks`)

- [ ] Create `TasksListPage`
  - [ ] Page header with title + "Sarcină nouă" button
  - [ ] View toggle (List, Kanban, Calendar)
  - [ ] Filter pills (status, priority, assignee)
  - [ ] Search box

- [ ] Create `TasksListView`
  - [ ] Collapsible sections (Urgente, Această săptămână, Finalizate)
  - [ ] Task items with all meta
  - [ ] Click → slide-over or modal

- [ ] Create `NewTaskModal`
  - [ ] Title input
  - [ ] Description textarea
  - [ ] Case selector
  - [ ] Priority selector
  - [ ] Due date picker
  - [ ] Assignee selector
  - [ ] Subtasks section

- [ ] Create `TaskDetailSlideOver`
  - [ ] Full task info
  - [ ] Edit in place
  - [ ] Subtasks list
  - [ ] Comments/activity

### Documents (`/documents`)

- [ ] Create `DocumentsPage`
  - [ ] Page header with title + "Încarcă" button
  - [ ] Status toggle (Ciornă, Review, Final)
  - [ ] View toggle (Grid, List)
  - [ ] Period sections (collapsible)

- [ ] Create `DocumentGridView`
  - [ ] 4-column grid
  - [ ] Document cards with thumbnails
  - [ ] Hover actions

- [ ] Create `DocumentListView`
  - [ ] Minimal table
  - [ ] Name, case, type, size, date, actions

- [ ] Create `DocumentPreview` modal
  - [ ] Full-screen or large modal
  - [ ] PDF/image viewer
  - [ ] Download, share, edit buttons

- [ ] Create `UploadDocumentModal`
  - [ ] Drag-drop zone
  - [ ] File picker
  - [ ] Case selector
  - [ ] Document type/status

### Communications (`/communications`)

- [ ] Create `CommunicationsPage`
  - [ ] Page header with "Sincronizează" button
  - [ ] View filter (Toate, Necitite, Trimise, Ciorne)
  - [ ] Email list (sender, subject, preview, date)

- [ ] Create `EmailListItem`
  - [ ] Unread indicator (bold)
  - [ ] Sender avatar
  - [ ] Subject + preview
  - [ ] Date/time
  - [ ] Attachment indicator

- [ ] Create `EmailDetailSlideOver`
  - [ ] Full email header (from, to, cc, date)
  - [ ] Email body (HTML rendered)
  - [ ] Attachments section
  - [ ] Reply, Forward, Archive actions

- [ ] Create `ComposeEmailModal`
  - [ ] To, Cc, Bcc fields
  - [ ] Subject input
  - [ ] Rich text editor
  - [ ] AI draft button (with glow)
  - [ ] Attachments section
  - [ ] Send button

### Calendar (`/calendar`)

- [ ] Create `CalendarPage`
  - [ ] Page header with "Eveniment nou" button
  - [ ] View toggle (Zi, Săptămână, Lună, Agendă)
  - [ ] Navigation (prev/next, today)
  - [ ] Filter by event type

- [ ] Create `WeekView`
  - [ ] 7-day columns
  - [ ] Time grid (hours)
  - [ ] Event blocks (colored by type)
  - [ ] Current time indicator

- [ ] Create `MonthView`
  - [ ] Calendar grid
  - [ ] Date cells with event dots
  - [ ] Click day → day detail

- [ ] Create `AgendaView`
  - [ ] Date section headers
  - [ ] Event list items
  - [ ] Time + title + location

- [ ] Create `EventDetailModal`
  - [ ] Event info (title, time, location)
  - [ ] Related case link
  - [ ] Attendees
  - [ ] Edit, Delete buttons

- [ ] Create `NewEventModal`
  - [ ] Title input
  - [ ] Event type selector
  - [ ] Date/time pickers
  - [ ] Location input
  - [ ] Case link (optional)
  - [ ] Add attendees

### Time Tracking (`/pontaj`)

- [ ] Create `TimeTrackingPage`
  - [ ] Page header with "Adaugă timp" button
  - [ ] Period selector (week picker)
  - [ ] Grouped table by day

- [ ] Create `TimeEntryTable`
  - [ ] Grouped by day
  - [ ] Columns: case, activity, hours, billable status
  - [ ] Daily totals
  - [ ] Weekly total

- [ ] Create `AddTimeEntryModal`
  - [ ] Case selector
  - [ ] Activity description
  - [ ] Hours input (with increment buttons)
  - [ ] Date picker
  - [ ] Billable toggle

- [ ] Create `TimeEntryRow`
  - [ ] Inline edit on click
  - [ ] Quick delete

### Clients (`/clients`)

> Linear Philosophy: Minimal list with essential info, quick actions

- [ ] Create `ClientsListPage`
  - [ ] Page header with "Client nou" button
  - [ ] Search box
  - [ ] Status filter (Activ, Inactiv, Toate)

- [ ] Create `ClientsTable`
  - [ ] Columns: name, contact, cases count, status
  - [ ] Minimal table pattern
  - [ ] Row click → client detail

- [ ] Create `NewClientModal`
  - [ ] Name input
  - [ ] Contact person
  - [ ] Email, phone
  - [ ] Address
  - [ ] Notes

- [ ] Create `ClientDetailPage`
  - [ ] Client header (name, type, status)
  - [ ] Contact info section
  - [ ] Cases list (linked to this client)
  - [ ] Billing history section
  - [ ] Notes/documents section

### Billing (`/facturare`)

> Linear Philosophy: Clean invoice list, quick status updates, clear totals

- [ ] Create `BillingPage`
  - [ ] Page header with "Factură nouă" button
  - [ ] Period filter (month selector)
  - [ ] Status toggle (Toate, Neplătite, Plătite, Anulate)

- [ ] Create `InvoicesTable`
  - [ ] Columns: number, client, amount, date, due date, status
  - [ ] Report table pattern with totals footer
  - [ ] Status badges (Plătită, În așteptare, Scadentă, Anulată)

- [ ] Create `NewInvoiceModal`
  - [ ] Client selector
  - [ ] Case selector (optional)
  - [ ] Line items section (add/remove)
  - [ ] Subtotal, tax, total display
  - [ ] Due date picker
  - [ ] Notes field

- [ ] Create `InvoiceDetailPage`
  - [ ] Invoice header (number, date, status)
  - [ ] Client info
  - [ ] Line items table
  - [ ] Totals section
  - [ ] Actions: Mark paid, Send, Download PDF

### Reports (`/rapoarte`)

> Linear Philosophy: Focused dashboards, key metrics, export capability

- [ ] Create `ReportsPage`
  - [ ] Report type selector (tabs or cards)
  - [ ] Date range picker
  - [ ] Export button (CSV, PDF)

- [ ] Create `CaseMetricsReport`
  - [ ] Active vs closed cases chart
  - [ ] Cases by type breakdown
  - [ ] Cases by status
  - [ ] Average resolution time

- [ ] Create `TimeReport`
  - [ ] Hours by team member
  - [ ] Hours by case
  - [ ] Billable vs non-billable
  - [ ] Utilization rates

- [ ] Create `BillingReport`
  - [ ] Revenue by month
  - [ ] Outstanding invoices
  - [ ] Collection rate
  - [ ] Top clients by billing

- [ ] Create `AIUsageReport`
  - [ ] Tokens used
  - [ ] Cost breakdown
  - [ ] Usage by feature
  - [ ] Usage by user

### Settings (`/setari`)

> Linear Philosophy: Grouped sections, minimal controls, instant save

- [ ] Create `SettingsPage`
  - [ ] Sidebar with section links
  - [ ] Content area for active section

- [ ] Create `ProfileSettings`
  - [ ] Avatar upload
  - [ ] Name, email (read-only)
  - [ ] Role display
  - [ ] Notification preferences

- [ ] Create `FirmSettings` (admin only)
  - [ ] Firm name, logo
  - [ ] Address, contact info
  - [ ] Invoice prefix/format
  - [ ] Default currency (€)

- [ ] Create `IntegrationSettings`
  - [ ] Microsoft 365 connection status
  - [ ] Sync settings
  - [ ] Disconnect button

- [ ] Create `TeamSettings` (admin only)
  - [ ] Team members list
  - [ ] Invite new member button
  - [ ] Role management
  - [ ] Deactivate users

- [ ] Create `BillingSettings` (admin only)
  - [ ] Hourly rates by role
  - [ ] Tax settings
  - [ ] Payment terms
  - [ ] Invoice templates

### User Management (`/admin/users`)

> Linear Philosophy: Simple table, role badges, quick actions

- [ ] Create `UsersListPage`
  - [ ] Page header with "Invită utilizator" button
  - [ ] Status filter (Activ, Invitat, Dezactivat)

- [ ] Create `UsersTable`
  - [ ] Avatar + name
  - [ ] Email
  - [ ] Role badge
  - [ ] Status dot
  - [ ] Last active date
  - [ ] Actions dropdown

- [ ] Create `InviteUserModal`
  - [ ] Email input
  - [ ] Role selector
  - [ ] Send invitation button

- [ ] Create `EditUserModal`
  - [ ] Role selector
  - [ ] Permissions checkboxes
  - [ ] Deactivate option

---

## 5. States

### Loading States

- [ ] Create `Skeleton` components
  - [ ] Text skeleton
  - [ ] Card skeleton
  - [ ] Table row skeleton
  - [ ] Shimmer animation

- [ ] Create `Spinner` component
  - [ ] Sizes: sm (16px), md (24px), lg (32px)
  - [ ] With optional label

- [ ] Add skeleton states to all pages
  - [ ] Dashboard widgets
  - [ ] Case list
  - [ ] Task list
  - [ ] Documents grid

### Empty States

- [ ] Create `EmptyState` component
  - [ ] Icon slot
  - [ ] Title
  - [ ] Description
  - [ ] CTA button (optional)

- [ ] Create page-specific empty states
  - [ ] No cases: "Niciun caz încă"
  - [ ] No tasks: "Nicio sarcină"
  - [ ] No documents: "Niciun document"
  - [ ] No emails: "Niciun mesaj"
  - [ ] No events: "Niciun eveniment"
  - [ ] No results: "Niciun rezultat găsit"

### Error States

- [ ] Create `ErrorState` component
  - [ ] Error icon
  - [ ] Message
  - [ ] Retry button

- [ ] Create `ErrorBoundary` component
  - [ ] Catch React errors
  - [ ] Show error UI
  - [ ] Report to logging

---

## 6. Interactions

### Keyboard Shortcuts

- [ ] Implement global shortcuts
  - [ ] `⌘K` → Command palette
  - [ ] `⌘N` → New case
  - [ ] `⌘T` → New task
  - [ ] `⌘L` → Log time
  - [ ] `⌘J` → AI assistant
  - [ ] `⌘G` → Go to case
  - [ ] `Escape` → Close modal

- [ ] Implement modal shortcuts
  - [ ] `⌘Enter` → Submit form
  - [ ] `↑↓` → Navigate items
  - [ ] `Enter` → Select item

### Hover States

- [ ] Add hover states to all interactive elements
  - [ ] Buttons: background change
  - [ ] Cards: border + shadow
  - [ ] Rows: background highlight
  - [ ] Links: underline or color change

### Focus States

- [ ] Add focus rings to all inputs
  - [ ] Accent border
  - [ ] 3px accent glow

- [ ] Add focus states to buttons
  - [ ] Visible focus ring

### Animations

- [ ] Add transitions
  - [ ] Color/opacity: 0.15s ease
  - [ ] Transform/shadow: 0.2s ease
  - [ ] Modal enter: 0.15s ease
  - [ ] Slide-over: 0.2s ease

- [ ] Add collapse/expand animations
  - [ ] Smooth height transitions
  - [ ] Icon rotation

---

## 7. Accessibility

### Keyboard Navigation

- [ ] Ensure all interactive elements are focusable
- [ ] Implement logical tab order
- [ ] Add skip links for main content

### Screen Readers

- [ ] Add `aria-label` to icon-only buttons
- [ ] Add `role="alert"` to error states
- [ ] Add proper heading hierarchy (h1 → h2 → h3)
- [ ] Add `aria-expanded` to collapsible sections

### Color Contrast

- [ ] Verify text contrast ratios (4.5:1 minimum)
- [ ] Don't rely on color alone for status

### Motion

- [ ] Add `prefers-reduced-motion` support
- [ ] Provide static alternatives

---

## 8. Testing

### Visual Testing

- [ ] Test on common viewport widths
  - [ ] 1024px (min desktop)
  - [ ] 1280px (common)
  - [ ] 1440px (wide)
  - [ ] 1920px (full HD)

- [ ] Test with different content lengths
  - [ ] Long titles
  - [ ] Many items
  - [ ] Empty states

### Functional Testing

- [ ] Test all form submissions
- [ ] Test modal open/close
- [ ] Test keyboard shortcuts
- [ ] Test error states

### Performance

- [ ] Verify smooth scrolling
- [ ] Verify fast modal transitions
- [ ] Test with slow network (loading states)

---

## 9. Documentation

- [ ] Update component storybook
- [ ] Document component props
- [ ] Document keyboard shortcuts
- [ ] Create visual QA checklist

---

## Priority Order

1. **Foundation**: Tokens, AppLayout, Sidebar, PageLayout
2. **Core Components**: Buttons, inputs, cards, status indicators
3. **Modals**: ConfirmDialog, FormModal, Toast (used everywhere)
4. **Dashboard**: First visible page
5. **Cases**: Most used feature
6. **Tasks**: Second most used
7. **Documents**: Medium priority
8. **Calendar**: Medium priority
9. **Communications**: Complex, medium priority
10. **Time Tracking**: Important for billing
11. **Billing**: Business critical
12. **Reports**: Lower priority
13. **Settings**: Lower priority
14. **Polish**: Animations, keyboard shortcuts, edge cases

---

## Linear Design Philosophy Reminders

When implementing pages not fully documented, follow these Linear principles:

### Visual Hierarchy

- Use typography weight and size for hierarchy, not colors
- Primary text `#EEEFF1`, secondary `#A1A1AA`, tertiary `#71717A`
- Status dots over status badges where possible
- Minimal use of icons in UI chrome

### Spacing & Layout

- Consistent 16-24px padding in cards
- 8-12px gaps between elements
- 20px page margins
- 240px fixed sidebar

### Interactions

- Subtle hover states (background change, border strengthen)
- No loud animations or transitions
- Keyboard shortcuts for power users
- Command palette for quick navigation

### Data Display

- Show only essential information
- Progressive disclosure (expand for more)
- Prefer tables for scannable data
- Use cards for rich content items

### Forms & Actions

- Primary action always prominent
- Destructive actions require confirmation
- Inline validation, not just on submit
- Auto-save where appropriate

### States

- Clear loading indicators (skeletons)
- Helpful empty states with CTAs
- Recoverable error states with retry
- Toast notifications for async feedback
