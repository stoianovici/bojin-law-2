/**
 * TimeEntryForm Component
 * Form for creating new time entries
 */

'use client';

import React from 'react';
import { useTimeTrackingStore } from '../../stores/time-tracking.store';
import type { TimeTaskType } from '@legal-platform/types';

const taskTypes: { value: TimeTaskType; label: string }[] = [
  { value: 'Research', label: 'Cercetare' },
  { value: 'Drafting', label: 'Redactare' },
  { value: 'ClientMeeting', label: 'Întâlnire Client' },
  { value: 'CourtAppearance', label: 'Prezentare Instanță' },
  { value: 'Email', label: 'Email' },
  { value: 'PhoneCall', label: 'Apel Telefonic' },
  { value: 'Administrative', label: 'Administrativ' },
  { value: 'Other', label: 'Altele' },
];

const mockCases = [
  { id: 'case-1', name: 'Dosar Popescu vs. SRL Construct' },
  { id: 'case-2', name: 'Contract Ionescu - Furnizare Servicii' },
  { id: 'case-3', name: 'Litigiu Georgescu - Proprietate' },
  { id: 'case-4', name: 'Advisory Dumitrescu SRL' },
  { id: 'case-5', name: 'Contencios Marin vs. Primărie' },
];

export function TimeEntryForm() {
  const addTimeEntry = useTimeTrackingStore((state) => state.addTimeEntry);

  const [formData, setFormData] = React.useState({
    date: new Date().toISOString().split('T')[0],
    caseId: '',
    taskType: '' as TimeTaskType | '',
    hours: '',
    minutes: '',
    description: '',
    isBillable: true,
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};

    if (!formData.date) {
      newErrors.date = 'Data este obligatorie';
    }

    if (!formData.caseId) {
      newErrors.caseId = 'Dosarul este obligatoriu';
    }

    if (!formData.taskType) {
      newErrors.taskType = 'Tipul activității este obligatoriu';
    }

    const hours = parseInt(formData.hours) || 0;
    const minutes = parseInt(formData.minutes) || 0;
    const totalMinutes = hours * 60 + minutes;

    if (totalMinutes <= 0) {
      newErrors.duration = 'Durata trebuie să fie mai mare decât 0';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Submit
    const selectedCase = mockCases.find((c) => c.id === formData.caseId);

    addTimeEntry({
      userId: 'user-001',
      userName: 'Current User',
      caseId: formData.caseId,
      caseName: selectedCase?.name || 'Unknown Case',
      taskType: formData.taskType as TimeTaskType,
      date: new Date(formData.date),
      duration: totalMinutes,
      description: formData.description,
      isBillable: formData.isBillable,
    });

    // Reset form
    setFormData({
      date: new Date().toISOString().split('T')[0],
      caseId: '',
      taskType: '',
      hours: '',
      minutes: '',
      description: '',
      isBillable: true,
    });
    setErrors({});
  };

  const handleClear = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      caseId: '',
      taskType: '',
      hours: '',
      minutes: '',
      description: '',
      isBillable: true,
    });
    setErrors({});
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Adaugă Intrare Pontaj</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date */}
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
            Dată *
          </label>
          <input
            type="date"
            id="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
        </div>

        {/* Case */}
        <div>
          <label htmlFor="case" className="block text-sm font-medium text-gray-700 mb-1">
            Dosar *
          </label>
          <select
            id="case"
            value={formData.caseId}
            onChange={(e) => setFormData({ ...formData, caseId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selectează dosarul</option>
            {mockCases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.caseId && <p className="mt-1 text-sm text-red-600">{errors.caseId}</p>}
        </div>

        {/* Task Type */}
        <div>
          <label htmlFor="taskType" className="block text-sm font-medium text-gray-700 mb-1">
            Tip Activitate *
          </label>
          <select
            id="taskType"
            value={formData.taskType}
            onChange={(e) => setFormData({ ...formData, taskType: e.target.value as TimeTaskType })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selectează tipul</option>
            {taskTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {errors.taskType && <p className="mt-1 text-sm text-red-600">{errors.taskType}</p>}
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Durată *</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                min="0"
                max="23"
                placeholder="Ore"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="flex items-center text-gray-500">:</span>
            <div className="flex-1">
              <input
                type="number"
                min="0"
                max="59"
                placeholder="Min"
                value={formData.minutes}
                onChange={(e) => setFormData({ ...formData, minutes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {errors.duration && <p className="mt-1 text-sm text-red-600">{errors.duration}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Descriere
          </label>
          <textarea
            id="description"
            rows={3}
            maxLength={200}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Detalii despre activitate..."
          />
          <p className="mt-1 text-xs text-gray-500 text-right">
            {formData.description.length}/200 caractere
          </p>
        </div>

        {/* Billable */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="billable"
            checked={formData.isBillable}
            onChange={(e) => setFormData({ ...formData, isBillable: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="billable" className="ml-2 text-sm text-gray-700">
            Facturabil
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
          >
            Salvează Intrare
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Golește
          </button>
        </div>
      </form>
    </div>
  );
}
