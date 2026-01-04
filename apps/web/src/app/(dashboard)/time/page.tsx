'use client';

import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui';
import { useState } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { ro } from 'date-fns/locale';

export default function TimePage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-linear-text-primary">Pontaj</h1>
          <p className="text-linear-text-secondary">Înregistrează orele lucrate</p>
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
          {format(weekStart, 'd MMM', { locale: ro })} -{' '}
          {format(addDays(weekStart, 4), 'd MMM yyyy', { locale: ro })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        >
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
              <div
                key={day.toISOString()}
                className="rounded-lg border border-linear-border-subtle p-4"
              >
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
                  <Button variant="ghost" size="sm">
                    +
                  </Button>
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
  );
}
