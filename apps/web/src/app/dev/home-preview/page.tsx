'use client';

import { useState } from 'react';
import {
  Briefcase,
  CheckSquare,
  FileText,
  Clock,
  AlertCircle,
  Calendar,
  ChevronRight,
  Plus,
  Search,
  Bell,
  User,
  TrendingUp,
  BarChart3,
  ArrowUpRight,
  Zap,
  Target,
  ListTodo,
  FolderOpen,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Avatar,
  AvatarFallback,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Separator,
} from '@/components/ui';

// Mock data for preview
const mockStats = {
  activeCases: 12,
  tasksInProgress: 8,
  overdueTasks: 3,
  weeklyHours: 32.5,
};

const mockTasks = [
  {
    id: '1',
    title: 'Pregătire dosar instanță',
    case: 'DOC-2024-001',
    dueDate: '30 Dec',
    priority: 'High',
    status: 'InProgress',
  },
  {
    id: '2',
    title: 'Revizuire contract achiziție',
    case: 'DOC-2024-002',
    dueDate: '31 Dec',
    priority: 'Medium',
    status: 'Pending',
  },
  {
    id: '3',
    title: 'Întocmire notificare',
    case: 'DOC-2024-003',
    dueDate: '2 Ian',
    priority: 'Low',
    status: 'Pending',
  },
  {
    id: '4',
    title: 'Analiză jurisprudență',
    case: 'DOC-2024-001',
    dueDate: '3 Ian',
    priority: 'Medium',
    status: 'Pending',
  },
];

const mockOverdue = [
  {
    id: '5',
    title: 'Depunere cerere tribunal',
    case: 'DOC-2024-005',
    dueDate: '27 Dec',
    priority: 'Urgent',
  },
  {
    id: '6',
    title: 'Răspuns interogatoriu',
    case: 'DOC-2024-006',
    dueDate: '28 Dec',
    priority: 'High',
  },
];

const mockCases = [
  {
    id: '1',
    number: 'DOC-2024-001',
    title: 'SC Alpha SRL vs. SC Beta SA',
    status: 'Active',
    type: 'Litigii',
  },
  {
    id: '2',
    number: 'DOC-2024-002',
    title: 'Contract M&A - TechCorp',
    status: 'Active',
    type: 'Corporate',
  },
  {
    id: '3',
    number: 'DOC-2024-003',
    title: 'Due Diligence - StartupX',
    status: 'Active',
    type: 'Corporate',
  },
];

const mockActivity = [
  {
    id: '1',
    user: 'Maria P.',
    action: 'a adăugat un document',
    target: 'DOC-2024-001',
    time: 'acum 2h',
  },
  {
    id: '2',
    user: 'Andrei S.',
    action: 'a actualizat status',
    target: 'DOC-2024-002',
    time: 'acum 3h',
  },
  {
    id: '3',
    user: 'Elena R.',
    action: 'a finalizat sarcina',
    target: 'Pregătire dosar',
    time: 'acum 5h',
  },
];

const priorityColors: Record<string, string> = {
  Urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  High: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

// ============================================
// VERSION 1: Clean Dashboard (Linear-style)
// ============================================
function HomeV1() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-linear-text-primary">Bună ziua, Demo</h1>
          <p className="text-linear-sm text-linear-text-secondary mt-1">
            Iată ce se întâmplă astăzi
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Caz nou
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card variant="interactive" className="group">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-linear-xs text-linear-text-muted uppercase tracking-wider">
                  Cazuri active
                </p>
                <p className="text-2xl font-bold text-linear-text-primary mt-1">
                  {mockStats.activeCases}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-linear-accent/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-linear-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="interactive" className="group">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-linear-xs text-linear-text-muted uppercase tracking-wider">
                  În lucru
                </p>
                <p className="text-2xl font-bold text-linear-text-primary mt-1">
                  {mockStats.tasksInProgress}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CheckSquare className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="interactive" className="group border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-linear-xs text-linear-text-muted uppercase tracking-wider">
                  Întârziate
                </p>
                <p className="text-2xl font-bold text-red-400 mt-1">{mockStats.overdueTasks}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="interactive" className="group">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-linear-xs text-linear-text-muted uppercase tracking-wider">
                  Ore săptămâna
                </p>
                <p className="text-2xl font-bold text-linear-text-primary mt-1">
                  {mockStats.weeklyHours}h
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-6">
        {/* Upcoming Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-linear-base">Termene apropiate</CardTitle>
            <Button variant="ghost" size="sm" className="text-linear-text-muted">
              Vezi toate <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {mockTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between py-2.5 px-2 rounded-md hover:bg-linear-bg-tertiary transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${task.priority === 'High' ? 'bg-orange-400' : task.priority === 'Medium' ? 'bg-yellow-400' : 'bg-gray-400'}`}
                  />
                  <div className="min-w-0">
                    <p className="text-linear-sm text-linear-text-primary truncate">{task.title}</p>
                    <p className="text-linear-xs text-linear-text-muted">{task.case}</p>
                  </div>
                </div>
                <span className="text-linear-xs text-linear-text-secondary shrink-0 ml-2">
                  {task.dueDate}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className="border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <CardTitle className="text-linear-base text-red-400">Întârziate</CardTitle>
            </div>
            <Badge variant="error">{mockOverdue.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-1">
            {mockOverdue.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between py-2.5 px-2 rounded-md hover:bg-red-500/5 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <div className="min-w-0">
                    <p className="text-linear-sm text-linear-text-primary truncate">{task.title}</p>
                    <p className="text-linear-xs text-linear-text-muted">{task.case}</p>
                  </div>
                </div>
                <span className="text-linear-xs text-red-400 shrink-0 ml-2">{task.dueDate}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// VERSION 2: Activity-focused with timeline
// ============================================
function HomeV2() {
  return (
    <div className="p-6 space-y-6">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-linear-text-primary">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Azi
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Crează
          </Button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="flex items-center gap-6 p-4 rounded-lg bg-linear-bg-elevated border border-linear-border-subtle">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-linear-text-muted" />
          <span className="text-linear-sm text-linear-text-secondary">Cazuri:</span>
          <span className="text-linear-sm font-semibold text-linear-text-primary">
            {mockStats.activeCases}
          </span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-linear-text-muted" />
          <span className="text-linear-sm text-linear-text-secondary">Sarcini:</span>
          <span className="text-linear-sm font-semibold text-linear-text-primary">
            {mockStats.tasksInProgress}
          </span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-linear-sm text-linear-text-secondary">Întârziate:</span>
          <span className="text-linear-sm font-semibold text-red-400">
            {mockStats.overdueTasks}
          </span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-linear-text-muted" />
          <span className="text-linear-sm text-linear-text-secondary">Ore:</span>
          <span className="text-linear-sm font-semibold text-linear-text-primary">
            {mockStats.weeklyHours}h
          </span>
        </div>
      </div>

      {/* Three columns */}
      <div className="grid grid-cols-3 gap-6">
        {/* Priority Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-linear-sm font-medium text-linear-text-primary flex items-center gap-2">
              <Target className="h-4 w-4 text-red-400" />
              Prioritare
            </h2>
          </div>
          <div className="space-y-2">
            {mockOverdue.map((task) => (
              <Card key={task.id} className="border-red-500/30 bg-red-500/5">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-linear-sm font-medium text-linear-text-primary">
                        {task.title}
                      </p>
                      <p className="text-linear-xs text-linear-text-muted mt-0.5">{task.case}</p>
                    </div>
                    <Badge variant="error" className="shrink-0 text-[10px]">
                      {task.priority}
                    </Badge>
                  </div>
                  <p className="text-linear-xs text-red-400 mt-2">Întârziat: {task.dueDate}</p>
                </CardContent>
              </Card>
            ))}
            {mockTasks.slice(0, 1).map((task) => (
              <Card key={task.id} className="border-orange-500/20">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-linear-sm font-medium text-linear-text-primary">
                        {task.title}
                      </p>
                      <p className="text-linear-xs text-linear-text-muted mt-0.5">{task.case}</p>
                    </div>
                    <Badge variant="warning" className="shrink-0 text-[10px]">
                      High
                    </Badge>
                  </div>
                  <p className="text-linear-xs text-linear-text-secondary mt-2">
                    Termen: {task.dueDate}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Cases */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-linear-sm font-medium text-linear-text-primary flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-linear-accent" />
              Cazuri recente
            </h2>
            <Button variant="ghost" size="sm" className="h-6 text-linear-xs">
              Vezi toate
            </Button>
          </div>
          <div className="space-y-2">
            {mockCases.map((c) => (
              <Card key={c.id} variant="interactive">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-linear-xs text-linear-accent font-mono">{c.number}</p>
                      <p className="text-linear-sm font-medium text-linear-text-primary mt-0.5 truncate">
                        {c.title}
                      </p>
                    </div>
                    <Badge variant="info" className="shrink-0 text-[10px]">
                      {c.type}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-linear-sm font-medium text-linear-text-primary flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              Activitate
            </h2>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-linear-border-subtle">
                {mockActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="p-3 hover:bg-linear-bg-tertiary transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {activity.user
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-linear-xs text-linear-text-primary">
                          <span className="font-medium">{activity.user}</span> {activity.action}
                        </p>
                        <p className="text-linear-xs text-linear-accent truncate">
                          {activity.target}
                        </p>
                      </div>
                      <span className="text-[10px] text-linear-text-muted shrink-0">
                        {activity.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================
// VERSION 3: Command Center with tabs
// ============================================
function HomeV3() {
  return (
    <div className="p-6 space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-linear-accent/20 via-linear-bg-elevated to-linear-bg-elevated border border-linear-border-subtle p-6">
        <div className="relative z-10">
          <p className="text-linear-sm text-linear-text-secondary">Bună ziua,</p>
          <h1 className="text-2xl font-bold text-linear-text-primary mt-1">Demo Partner</h1>
          <p className="text-linear-sm text-linear-text-muted mt-2">
            Ai {mockStats.overdueTasks} sarcini întârziate și {mockStats.tasksInProgress} în lucru
          </p>

          <div className="flex items-center gap-3 mt-4">
            <Button>
              <ListTodo className="h-4 w-4 mr-2" />
              Vezi sarcinile
            </Button>
            <Button variant="secondary">
              <Plus className="h-4 w-4 mr-2" />
              Caz nou
            </Button>
          </div>
        </div>
        <div className="absolute right-6 top-6 opacity-10">
          <BarChart3 className="h-32 w-32 text-linear-accent" />
        </div>
      </div>

      {/* Stats Grid - more visual */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-linear-bg-elevated border border-linear-border-subtle">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-linear-accent/10 flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-linear-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-linear-text-primary">{mockStats.activeCases}</p>
              <p className="text-linear-xs text-linear-text-muted">Cazuri active</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-linear-bg-elevated border border-linear-border-subtle">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <CheckSquare className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-linear-text-primary">
                {mockStats.tasksInProgress}
              </p>
              <p className="text-linear-xs text-linear-text-muted">În lucru</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{mockStats.overdueTasks}</p>
              <p className="text-linear-xs text-linear-text-muted">Întârziate</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-linear-bg-elevated border border-linear-border-subtle">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-linear-text-primary">
                {mockStats.weeklyHours}h
              </p>
              <p className="text-linear-xs text-linear-text-muted">Ore săptămâna</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="tasks">
            <CheckSquare className="h-4 w-4 mr-2" />
            Sarcini
          </TabsTrigger>
          <TabsTrigger value="cases">
            <Briefcase className="h-4 w-4 mr-2" />
            Cazuri
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Zap className="h-4 w-4 mr-2" />
            Activitate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-linear-base">Sarcini urgente și apropiate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...mockOverdue, ...mockTasks.slice(0, 2)].map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-linear-bg-tertiary hover:bg-linear-bg-elevated transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${task.priority === 'Urgent' ? 'bg-red-400' : task.priority === 'High' ? 'bg-orange-400' : task.priority === 'Medium' ? 'bg-yellow-400' : 'bg-gray-400'}`}
                      />
                      <div>
                        <p className="text-linear-sm font-medium text-linear-text-primary">
                          {task.title}
                        </p>
                        <p className="text-linear-xs text-linear-text-muted">{task.case}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={priorityColors[task.priority]} variant="default">
                        {task.priority}
                      </Badge>
                      <span className="text-linear-xs text-linear-text-secondary">
                        {task.dueDate}
                      </span>
                      <Button variant="ghost" size="sm" className="h-7">
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cases" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-linear-base">Cazurile tale active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {mockCases.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-lg bg-linear-bg-tertiary hover:bg-linear-bg-elevated transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-linear-xs text-linear-accent font-mono">{c.number}</p>
                        <p className="text-linear-sm font-medium text-linear-text-primary mt-1">
                          {c.title}
                        </p>
                      </div>
                      <Badge variant="info">{c.type}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-linear-base">Activitate recentă</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {activity.user
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-linear-sm text-linear-text-primary">
                        <span className="font-medium">{activity.user}</span> {activity.action}
                      </p>
                      <p className="text-linear-xs text-linear-accent">{activity.target}</p>
                    </div>
                    <span className="text-linear-xs text-linear-text-muted">{activity.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// VERSION 4: Mockup Match (from design reference)
// ============================================
function HomeV4() {
  const weekday = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
  const months = [
    'ianuarie',
    'februarie',
    'martie',
    'aprilie',
    'mai',
    'iunie',
    'iulie',
    'august',
    'septembrie',
    'octombrie',
    'noiembrie',
    'decembrie',
  ];
  const now = new Date();
  const dateStr = `${weekday[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

  const watchedCases = [
    {
      id: '1',
      number: 'CAZ-2024-0156',
      title: 'Ionescu vs. SC Alpha SRL',
      client: 'Ionescu Maria',
      status: 'urgent',
    },
    {
      id: '2',
      number: 'CAZ-2024-0148',
      title: 'Contract fuziune Beta Corp',
      client: 'Beta Corporation',
      status: 'active',
    },
    {
      id: '3',
      number: 'CAZ-2024-0142',
      title: 'Litigiu proprietate industrială',
      client: 'TechStart SRL',
      status: 'active',
    },
    {
      id: '4',
      number: 'CAZ-2024-0139',
      title: 'Consultanță GDPR',
      client: 'DataSafe SRL',
      status: 'warning',
    },
  ];

  const myTasks = [
    {
      id: '1',
      title: 'Pregătire răspuns la întâmpinare',
      caseNumber: 'CAZ-2024-0156',
      priority: 'Urgent',
      dueDate: 'Mâine',
    },
    {
      id: '2',
      title: 'Revizuire contract fuziune',
      caseNumber: 'CAZ-2024-0148',
      priority: 'Prioritate înaltă',
      dueDate: '30 Dec',
    },
    {
      id: '3',
      title: 'Întâlnire client TechStart',
      caseNumber: 'CAZ-2024-0142',
      priority: 'Normal',
      dueDate: '2 Ian',
    },
    {
      id: '4',
      title: 'Audit documentație GDPR',
      caseNumber: 'CAZ-2024-0139',
      priority: 'Normal',
      dueDate: '5 Ian',
    },
  ];

  const teamUtilization = [
    { initials: 'MP', name: 'Maria Popescu', percentage: 92 },
    { initials: 'AI', name: 'Andrei Ionescu', percentage: 87 },
    { initials: 'ED', name: 'Elena Dumitrescu', percentage: 78 },
    { initials: 'CV', name: 'Cristian Vasile', percentage: 65 },
  ];

  const statusColors: Record<string, string> = {
    urgent: 'bg-red-500',
    active: 'bg-green-500',
    warning: 'bg-yellow-500',
  };

  const priorityStyles: Record<string, string> = {
    Urgent: 'bg-red-500/20 text-red-400 border border-red-500/30',
    'Prioritate înaltă': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    Normal: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Greeting Section */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-linear-bg-tertiary flex items-center justify-center">
            <User className="h-6 w-6 text-linear-text-muted" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-linear-text-primary">
              Bună dimineața, Alexandru
            </h1>
            <p className="text-linear-sm text-linear-text-muted">{dateStr}</p>
            <p className="text-linear-sm text-linear-text-secondary mt-3 max-w-2xl">
              Astăzi ai{' '}
              <span className="text-linear-text-primary font-medium">3 termene de judecată</span>{' '}
              programate și <span className="text-red-400 font-medium">5 sarcini urgente</span> de
              finalizat. Cazul{' '}
              <span className="text-linear-text-primary font-medium">Ionescu vs. SC Alpha SRL</span>{' '}
              necesită atenție - termenul de răspuns la întâmpinare expiră mâine. Echipa a
              înregistrat 87% din orele target săptămâna aceasta.
            </p>
          </div>
        </div>
        <Button variant="secondary">
          <Bell className="h-4 w-4 mr-2" />
          Actualizează
        </Button>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-8">
        <div className="text-center">
          <p className="text-3xl font-bold text-linear-text-primary">12</p>
          <p className="text-linear-xs text-linear-text-muted">Cazuri active</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-linear-text-primary">5</p>
          <p className="text-linear-xs text-linear-text-muted">Sarcini urgente</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-linear-text-primary">3</p>
          <p className="text-linear-xs text-linear-text-muted">Termene azi</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-linear-text-primary">87%</p>
          <p className="text-linear-xs text-linear-text-muted">Utilizare echipă</p>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Watched Cases */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-linear-text-muted" />
              <CardTitle className="text-linear-sm">Cazuri Supravegheate</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-linear-xs text-linear-text-muted h-auto p-0"
            >
              Vezi toate →
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {watchedCases.map((c) => (
              <div key={c.id} className="group cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-linear-xs text-linear-accent font-mono">{c.number}</p>
                    <p className="text-linear-sm font-medium text-linear-text-primary mt-0.5 group-hover:text-linear-accent transition-colors">
                      {c.title}
                    </p>
                    <p className="text-linear-xs text-linear-text-muted mt-0.5">{c.client}</p>
                  </div>
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${statusColors[c.status]}`}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* My Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-linear-text-muted" />
              <CardTitle className="text-linear-sm">Sarcinile Mele</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-linear-xs text-linear-text-muted h-auto p-0"
            >
              + Adaugă
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {myTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-3 group">
                <div className="mt-0.5">
                  <div className="w-4 h-4 rounded border border-linear-border-default group-hover:border-linear-accent transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-linear-sm text-linear-text-primary group-hover:text-linear-accent transition-colors cursor-pointer">
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${priorityStyles[task.priority]}`}
                    >
                      {task.priority}
                    </span>
                    <span className="text-linear-xs text-linear-text-muted">{task.caseNumber}</span>
                    <span className="text-linear-xs text-linear-text-muted">
                      Scadent: {task.dueDate}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Firm Metrics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-linear-text-muted" />
              <CardTitle className="text-linear-sm">Metrici Firmă</CardTitle>
            </div>
            <span className="text-linear-xs text-linear-text-muted">Această săptămână ▾</span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-2xl font-bold text-linear-text-primary">47</p>
                <p className="text-linear-xs text-linear-text-muted">Sarcini active</p>
                <p className="text-linear-xs text-green-400 mt-0.5">↑ +12% față de săpt. trecută</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-linear-text-primary">5</p>
                <p className="text-linear-xs text-linear-text-muted">Întârziate</p>
                <p className="text-linear-xs text-red-400 mt-0.5">↓ -3 față de săpt. trecută</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-linear-text-primary">8</p>
                <p className="text-linear-xs text-linear-text-muted">Scadențe azi</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-linear-text-primary">23</p>
                <p className="text-linear-xs text-linear-text-muted">Această săptămână</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Team Utilization + Quick Actions */}
      <div className="grid grid-cols-2 gap-6">
        {/* Team Utilization */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-linear-text-muted" />
              <CardTitle className="text-linear-sm">Utilizare Echipă</CardTitle>
            </div>
            <div className="flex items-center gap-4 text-linear-xs text-linear-text-muted">
              <span className="text-linear-text-primary">Săptămânal</span>
              <span>Lunar</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {teamUtilization.map((member) => (
              <div key={member.initials} className="flex items-center gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-linear-accent/20 text-linear-accent text-sm">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-linear-sm font-medium text-linear-text-primary">
                    {member.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex-1 h-1.5 bg-linear-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-linear-accent rounded-full"
                        style={{ width: `${member.percentage}%` }}
                      />
                    </div>
                    <span className="text-linear-sm text-linear-text-secondary w-10 text-right">
                      {member.percentage}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-linear-accent/20 flex items-center justify-center">
                <Zap className="h-3 w-3 text-linear-accent" />
              </div>
              <CardTitle className="text-linear-sm">Acțiuni rapide</CardTitle>
            </div>
            <span className="text-linear-xs text-linear-text-muted px-1.5 py-0.5 rounded bg-linear-bg-tertiary">
              ⌘K
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary">
              <Search className="h-4 w-4 text-linear-text-muted" />
              <span className="text-linear-sm text-linear-text-muted">
                Caută sau execută o comandă...
              </span>
            </div>

            {/* Frequent Actions */}
            <div>
              <p className="text-[10px] font-medium text-linear-text-muted uppercase tracking-wider mb-2">
                Acțiuni frecvente
              </p>
              <div className="space-y-1">
                <div className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-linear-bg-tertiary transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-linear-bg-tertiary flex items-center justify-center group-hover:bg-linear-bg-elevated">
                      <Plus className="h-4 w-4 text-linear-text-muted" />
                    </div>
                    <span className="text-linear-sm text-linear-text-primary">Caz nou</span>
                  </div>
                  <span className="text-linear-xs text-linear-text-muted px-1.5 py-0.5 rounded bg-linear-bg-tertiary">
                    ⌘N
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-linear-bg-tertiary transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-linear-bg-tertiary flex items-center justify-center group-hover:bg-linear-bg-elevated">
                      <CheckSquare className="h-4 w-4 text-linear-text-muted" />
                    </div>
                    <span className="text-linear-sm text-linear-text-primary">Sarcină nouă</span>
                  </div>
                  <span className="text-linear-xs text-linear-text-muted px-1.5 py-0.5 rounded bg-linear-bg-tertiary">
                    ⌘T
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-linear-bg-tertiary transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-linear-bg-tertiary flex items-center justify-center group-hover:bg-linear-bg-elevated">
                      <Clock className="h-4 w-4 text-linear-text-muted" />
                    </div>
                    <span className="text-linear-sm text-linear-text-primary">
                      Înregistrare timp
                    </span>
                  </div>
                  <span className="text-linear-xs text-linear-text-muted px-1.5 py-0.5 rounded bg-linear-bg-tertiary">
                    ⌘L
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-linear-bg-tertiary transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-linear-accent/20 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-linear-accent" />
                    </div>
                    <span className="text-linear-sm text-linear-text-primary">Întreabă AI</span>
                  </div>
                  <span className="text-linear-xs text-linear-text-muted px-1.5 py-0.5 rounded bg-linear-bg-tertiary">
                    ⌘J
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// Main Preview Page with Version Selector
// ============================================
export default function HomePreviewPage() {
  const [version, setVersion] = useState<1 | 2 | 3 | 4>(4);

  return (
    <div className="min-h-screen bg-linear-bg-primary">
      {/* Version Selector - Sticky Header */}
      <div className="sticky top-0 z-50 bg-linear-bg-primary/90 backdrop-blur-sm border-b border-linear-border-subtle">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-linear-base font-semibold text-linear-text-primary">
              Home Screen Preview
            </h1>
            <p className="text-linear-xs text-linear-text-muted">
              Selectează versiunea pentru vizualizare
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={version === 4 ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setVersion(4)}
            >
              V4: Mockup
            </Button>
            <Button
              variant={version === 1 ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setVersion(1)}
            >
              V1: Clean
            </Button>
            <Button
              variant={version === 2 ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setVersion(2)}
            >
              V2: Activity
            </Button>
            <Button
              variant={version === 3 ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setVersion(3)}
            >
              V3: Command
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <div className="max-w-[1200px] mx-auto">
        {version === 4 && <HomeV4 />}
        {version === 1 && <HomeV1 />}
        {version === 2 && <HomeV2 />}
        {version === 3 && <HomeV3 />}
      </div>

      {/* Version Info */}
      <div className="p-4 border-t border-linear-border-subtle">
        <div className="max-w-[1200px] mx-auto">
          {version === 4 && (
            <div className="p-4 rounded-lg bg-linear-bg-elevated border border-linear-accent/30">
              <h3 className="font-medium text-linear-text-primary">
                V4: Design Mockup (Recomandat)
              </h3>
              <p className="text-linear-sm text-linear-text-secondary mt-1">
                Implementare fidelă a mockup-ului din bojin-law-2. Greeting personalizat cu sumar
                contextual, statistici în linie, trei coloane (Cazuri Supravegheate, Sarcinile Mele,
                Metrici Firmă), plus secțiunea Utilizare Echipă cu progress bars.
              </p>
            </div>
          )}
          {version === 1 && (
            <div className="p-4 rounded-lg bg-linear-bg-elevated">
              <h3 className="font-medium text-linear-text-primary">V1: Clean Dashboard</h3>
              <p className="text-linear-sm text-linear-text-secondary mt-1">
                Design minimalist inspirat de Linear. Statistici clare în cards, focus pe termene și
                întârzieri. Două coloane pentru upcoming/overdue. Cel mai simplu și curat.
              </p>
            </div>
          )}
          {version === 2 && (
            <div className="p-4 rounded-lg bg-linear-bg-elevated">
              <h3 className="font-medium text-linear-text-primary">V2: Activity-Focused</h3>
              <p className="text-linear-sm text-linear-text-secondary mt-1">
                Design compact cu statistici în bara superioară. Trei coloane: Prioritar, Cazuri
                recente, Activitate. Focus pe action items și feed de activitate. Ideal pentru
                colaborare în echipă.
              </p>
            </div>
          )}
          {version === 3 && (
            <div className="p-4 rounded-lg bg-linear-bg-elevated">
              <h3 className="font-medium text-linear-text-primary">V3: Command Center</h3>
              <p className="text-linear-sm text-linear-text-secondary mt-1">
                Design vizual cu hero section și gradient. Statistici mari cu iconițe. Conținut
                organizat în tabs pentru sarcini/cazuri/activitate. Cel mai expresiv vizual.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
