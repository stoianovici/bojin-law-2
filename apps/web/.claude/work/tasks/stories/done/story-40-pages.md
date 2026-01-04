# Story 40: Dashboard Pages

**Parallelizable with**: NONE - run after Phase 3 (story-30)
**Depends on**: UI Components, Auth, Layout
**Blocks**: None (feature components come later)

---

## Sequential: Dashboard Layout First

### Task A: Create Dashboard Layout

**File**: `src/app/(dashboard)/layout.tsx` (CREATE)

**Do**:

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { AppShell, Sidebar, Header, CommandPalette } from '@/components/layout'
import { TooltipProvider } from '@/components/ui'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?returnUrl=' + encodeURIComponent(window.location.pathname))
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-linear-bg-primary">
        <div className="animate-spin h-8 w-8 border-2 border-linear-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect
  }

  return (
    <TooltipProvider>
      <AppShell
        sidebar={<Sidebar />}
        header={<Header />}
      >
        {children}
      </AppShell>
      <CommandPalette />
    </TooltipProvider>
  )
}
```

**Done when**: Protected route works, redirects to login, layout renders with sidebar/header

---

## Parallel Group B: Dashboard Page Shells

> These 5 tasks run simultaneously (different files)

### Task B1: Create Dashboard Home

**File**: `src/app/(dashboard)/page.tsx` (CREATE)

**Do**:

```typescript
'use client'

import { Briefcase, FileText, CheckSquare, Mail, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'

const stats = [
  { label: 'Cazuri active', value: '12', icon: Briefcase, href: '/cases' },
  { label: 'Sarcini în așteptare', value: '8', icon: CheckSquare, href: '/tasks' },
  { label: 'Emailuri necitite', value: '24', icon: Mail, href: '/email' },
  { label: 'Ore săptămâna aceasta', value: '32.5', icon: Clock, href: '/time' },
]

const quickActions = [
  { label: 'Caz nou', href: '/cases/new', icon: Briefcase },
  { label: 'Sarcină nouă', href: '/tasks/new', icon: CheckSquare },
  { label: 'Încarcă document', href: '/documents/upload', icon: FileText },
]

export default function DashboardPage() {
  const { user } = useAuth()

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bună dimineața'
    if (hour < 18) return 'Bună ziua'
    return 'Bună seara'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-linear-text-primary">
          {greeting()}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-linear-text-secondary">
          Iată ce se întâmplă astăzi
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card variant="interactive">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-linear-accent/10 p-2">
                    <stat.icon className="h-5 w-5 text-linear-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-linear-text-primary">
                      {stat.value}
                    </p>
                    <p className="text-sm text-linear-text-secondary">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acțiuni rapide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Button key={action.label} variant="secondary" asChild>
                <Link href={action.href}>
                  <action.icon className="mr-2 h-4 w-4" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent activity placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Activitate recentă</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-linear-text-muted">
            Activitatea recentă va apărea aici.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Done when**: Greeting shows, stats cards render, quick actions work

---

### Task B2: Create Cases Page Shell

**File**: `src/app/(dashboard)/cases/page.tsx` (CREATE)

**Do**:

```typescript
'use client'

import { Plus, Search, Filter } from 'lucide-react'
import { Button, Input, Tabs, TabsList, TabsTrigger, TabsContent, Card } from '@/components/ui'
import Link from 'next/link'

export default function CasesPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-linear-text-primary">Cazuri</h1>
          <p className="text-linear-text-secondary">
            Gestionează cazurile firmei
          </p>
        </div>
        <Button asChild>
          <Link href="/cases/new">
            <Plus className="mr-2 h-4 w-4" />
            Caz nou
          </Link>
        </Button>
      </div>

      {/* Tabs & Filters */}
      <Tabs defaultValue="active">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Arhivate</TabsTrigger>
            <TabsTrigger value="all">Toate</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-linear-text-muted" />
              <Input
                placeholder="Caută cazuri..."
                className="pl-9 w-64"
              />
            </div>
            <Button variant="ghost" size="sm">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="active" className="mt-6">
          {/* Case list placeholder */}
          <Card>
            <div className="p-8 text-center">
              <p className="text-linear-text-muted">
                Lista cazurilor active va apărea aici.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="archived" className="mt-6">
          <Card>
            <div className="p-8 text-center">
              <p className="text-linear-text-muted">
                Lista cazurilor arhivate va apărea aici.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <Card>
            <div className="p-8 text-center">
              <p className="text-linear-text-muted">
                Lista tuturor cazurilor va apărea aici.
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

**Done when**: Page header, tabs, search/filter bar render

---

### Task B3: Create Documents Page Shell

**File**: `src/app/(dashboard)/documents/page.tsx` (CREATE)

**Do**:

```typescript
'use client'

import { Upload, Search, Filter, Grid, List } from 'lucide-react'
import { Button, Input, Tabs, TabsList, TabsTrigger, Card } from '@/components/ui'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export default function DocumentsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-linear-text-primary">Documente</h1>
          <p className="text-linear-text-secondary">
            Gestionează documentele clienților
          </p>
        </div>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Încarcă document
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-linear-text-muted" />
            <Input
              placeholder="Caută documente..."
              className="pl-9 w-64"
            />
          </div>
          <Button variant="ghost" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filtre
          </Button>
        </div>

        {/* View toggle */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
          <TabsList variant="pills">
            <TabsTrigger value="grid">
              <Grid className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <Card>
        <div className="p-8 text-center">
          <p className="text-linear-text-muted">
            {viewMode === 'grid'
              ? 'Grila de documente va apărea aici.'
              : 'Lista de documente va apărea aici.'}
          </p>
        </div>
      </Card>
    </div>
  )
}
```

**Done when**: Page renders, view toggle works

---

### Task B4: Create Tasks Page Shell

**File**: `src/app/(dashboard)/tasks/page.tsx` (CREATE)

**Do**:

```typescript
'use client'

import { Plus, Search, Filter } from 'lucide-react'
import { Button, Input, Tabs, TabsList, TabsTrigger, TabsContent, Card } from '@/components/ui'
import Link from 'next/link'

export default function TasksPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-linear-text-primary">Sarcini</h1>
          <p className="text-linear-text-secondary">
            Gestionează sarcinile și termenele
          </p>
        </div>
        <Button asChild>
          <Link href="/tasks/new">
            <Plus className="mr-2 h-4 w-4" />
            Sarcină nouă
          </Link>
        </Button>
      </div>

      {/* Tabs & Filters */}
      <Tabs defaultValue="my">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="my">Sarcinile mele</TabsTrigger>
            <TabsTrigger value="all">Toate</TabsTrigger>
            <TabsTrigger value="overdue" className="text-linear-error">
              Întârziate
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-linear-text-muted" />
              <Input
                placeholder="Caută sarcini..."
                className="pl-9 w-64"
              />
            </div>
            <Button variant="ghost" size="sm">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="my" className="mt-6">
          <Card>
            <div className="p-8 text-center">
              <p className="text-linear-text-muted">
                Sarcinile tale vor apărea aici.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <Card>
            <div className="p-8 text-center">
              <p className="text-linear-text-muted">
                Toate sarcinile vor apărea aici.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="overdue" className="mt-6">
          <Card>
            <div className="p-8 text-center">
              <p className="text-linear-text-muted">
                Sarcinile întârziate vor apărea aici.
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

**Done when**: Page header, tabs, search render

---

### Task B5: Create Email Page Shell

**File**: `src/app/(dashboard)/email/page.tsx` (CREATE)

**Do**:

```typescript
'use client'

import { Edit, Search, Inbox, Send, AlertCircle } from 'lucide-react'
import { Button, Input, Tabs, TabsList, TabsTrigger, TabsContent, Card } from '@/components/ui'

export default function EmailPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-linear-text-primary">Email</h1>
          <p className="text-linear-text-secondary">
            Inbox-ul firmei și emailuri de clasificat
          </p>
        </div>
        <Button>
          <Edit className="mr-2 h-4 w-4" />
          Compune
        </Button>
      </div>

      {/* Tabs & Search */}
      <Tabs defaultValue="inbox">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="inbox">
              <Inbox className="mr-2 h-4 w-4" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="sent">
              <Send className="mr-2 h-4 w-4" />
              Trimise
            </TabsTrigger>
            <TabsTrigger value="review">
              <AlertCircle className="mr-2 h-4 w-4" />
              De clasificat
            </TabsTrigger>
          </TabsList>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-linear-text-muted" />
            <Input
              placeholder="Caută emailuri..."
              className="pl-9 w-64"
            />
          </div>
        </div>

        <TabsContent value="inbox" className="mt-6">
          <Card>
            <div className="p-8 text-center">
              <p className="text-linear-text-muted">
                Emailurile din inbox vor apărea aici.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="sent" className="mt-6">
          <Card>
            <div className="p-8 text-center">
              <p className="text-linear-text-muted">
                Emailurile trimise vor apărea aici.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="mt-6">
          <Card>
            <div className="p-8 text-center">
              <p className="text-linear-text-muted">
                Emailurile care necesită clasificare vor apărea aici.
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

**Done when**: Page header, folder tabs, search render

---

## Sequential: After Group B

### Task C: Create Timesheet Page

**File**: `src/app/(dashboard)/time/page.tsx` (CREATE)

**Do**:

```typescript
'use client'

import { ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui'
import { useState } from 'react'
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns'
import { ro } from 'date-fns/locale'

export default function TimePage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-linear-text-primary">Pontaj</h1>
          <p className="text-linear-text-secondary">
            Înregistrează orele lucrate
          </p>
        </div>
        <Button>
          <Save className="mr-2 h-4 w-4" />
          Salvează săptămâna
        </Button>
      </div>

      {/* Week selector */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-linear-text-primary">
          {format(weekStart, 'd MMM', { locale: ro })} - {format(addDays(weekStart, 4), 'd MMM yyyy', { locale: ro })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
          Săptămâna curentă
        </Button>
      </div>

      {/* Timesheet grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Daily entries */}
        <Card>
          <CardHeader>
            <CardTitle>Înregistrări zilnice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {days.map((day) => (
              <div key={day.toISOString()} className="rounded-lg border border-linear-border-subtle p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-linear-text-primary">
                    {format(day, 'EEEE, d MMMM', { locale: ro })}
                  </span>
                  <span className="text-sm text-linear-text-muted">0 ore</span>
                </div>

                {/* Entry row placeholder */}
                <div className="flex items-center gap-3">
                  <Select>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Selectează caz..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="case-1">Case #2024-001</SelectItem>
                      <SelectItem value="case-2">Case #2024-002</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Ore" className="w-20" step="0.5" />
                  <Input placeholder="Descriere..." className="flex-1" />
                  <Button variant="ghost" size="sm">+</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Weekly summary */}
        <Card>
          <CardHeader>
            <CardTitle>Sumar săptămânal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-linear-text-secondary">Total ore:</span>
              <span className="font-medium text-linear-text-primary">0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-linear-text-secondary">Ore facturabile:</span>
              <span className="font-medium text-linear-text-primary">0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-linear-text-secondary">Ore nefacturabile:</span>
              <span className="font-medium text-linear-text-primary">0</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Done when**: Week navigation, day entries, summary render

---

## Done when (entire story)

- Dashboard layout protects routes
- Home page shows stats and quick actions
- Cases page has tabs and search
- Documents page has view toggle
- Tasks page has tabs and search
- Email page has folder tabs
- Time page has week navigation and entry form
- All pages use Romanian text
- Build passes
