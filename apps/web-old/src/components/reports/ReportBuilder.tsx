'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import * as Checkbox from '@radix-ui/react-checkbox';
import type {
  ReportDataSource,
  ReportFilter,
  FilterOperator,
  CustomReport,
  ChartType,
} from '@legal-platform/types';
import { useReportsStore } from '../../stores/reports.store';
import { useUser } from '../../contexts/UserContext';

interface ReportBuilderProps {
  isOpen: boolean;
  onClose: () => void;
}

const DATA_SOURCES: Array<{ value: ReportDataSource; label: string }> = [
  { value: 'cases', label: 'Dosare' },
  { value: 'timeEntries', label: 'Înregistrări Pontaj' },
  { value: 'invoices', label: 'Facturi' },
  { value: 'clients', label: 'Clienți' },
  { value: 'documents', label: 'Documente' },
];

const AVAILABLE_FIELDS: Record<ReportDataSource, string[]> = {
  cases: ['Nume Dosar', 'Tip', 'Status', 'Valoare', 'Data Creare', 'Avocat'],
  timeEntries: ['Data', 'Ore', 'Tip Activitate', 'Dosar', 'Facturat'],
  invoices: ['Număr Factură', 'Client', 'Sumă', 'Data Emitere', 'Status Plată'],
  clients: ['Nume Client', 'Tip', 'Email', 'Telefon', 'Data Înregistrare'],
  documents: ['Nume Document', 'Tip', 'Dosar', 'Mărime', 'Data Upload'],
};

const FILTER_OPERATORS: Array<{ value: FilterOperator; label: string }> = [
  { value: 'equals', label: 'Este egal cu' },
  { value: 'notEquals', label: 'Nu este egal cu' },
  { value: 'greaterThan', label: 'Mai mare decât' },
  { value: 'lessThan', label: 'Mai mic decât' },
  { value: 'contains', label: 'Conține' },
  { value: 'between', label: 'Între' },
];

const CHART_TYPES: Array<{ value: ChartType; label: string }> = [
  { value: 'table', label: 'Tabel' },
  { value: 'bar', label: 'Grafic cu Bare' },
  { value: 'line', label: 'Grafic Liniar' },
  { value: 'pie', label: 'Grafic Circular' },
  { value: 'area', label: 'Grafic cu Arie' },
];

export function ReportBuilder({ isOpen, onClose }: ReportBuilderProps) {
  const { saveCustomReport } = useReportsStore();
  const { user } = useUser();

  const [currentStep, setCurrentStep] = useState(1);
  const [reportName, setReportName] = useState('');
  const [dataSource, setDataSource] = useState<ReportDataSource>('cases');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [groupBy, setGroupBy] = useState<string>('');
  const [chartType, setChartType] = useState<ChartType>('table');

  const totalSteps = 6;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveReport = () => {
    const newReport: CustomReport = {
      id: `custom-${crypto.randomUUID()}`,
      name: reportName || 'Raport Personalizat',
      dataSource,
      selectedFields,
      filters,
      groupBy,
      chartType,
      createdAt: new Date(),
      createdBy: `${user.firstName} ${user.lastName}`,
    };

    saveCustomReport(newReport);
    handleClose();
  };

  const handleClose = () => {
    setCurrentStep(1);
    setReportName('');
    setDataSource('cases');
    setSelectedFields([]);
    setFilters([]);
    setGroupBy('');
    setChartType('table');
    onClose();
  };

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const addFilter = () => {
    setFilters([...filters, { field: '', operator: 'equals', value: '' }]);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, key: keyof ReportFilter, value: string | number) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], [key]: value };
    setFilters(newFilters);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Nume Raport</label>
              <input
                type="text"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="Introduceți numele raportului..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Sursa de Date</label>
              <Select.Root
                value={dataSource}
                onValueChange={(v) => setDataSource(v as ReportDataSource)}
              >
                <Select.Trigger className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <Select.Value />
                  <Select.Icon>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                    <Select.Viewport className="p-1">
                      {DATA_SOURCES.map((source) => (
                        <Select.Item
                          key={source.value}
                          value={source.value}
                          className="relative flex cursor-pointer items-center rounded px-8 py-2 text-sm text-gray-900 outline-none hover:bg-blue-50 focus:bg-blue-50"
                        >
                          <Select.ItemText>{source.label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Selectați câmpurile pe care doriți să le includeți în raport:
            </p>
            <div className="max-h-[300px] space-y-2 overflow-y-auto">
              {AVAILABLE_FIELDS[dataSource].map((field) => (
                <div key={field} className="flex items-center gap-2">
                  <Checkbox.Root
                    id={`field-${field}`}
                    checked={selectedFields.includes(field)}
                    onCheckedChange={() => toggleField(field)}
                    className="flex h-5 w-5 items-center justify-center rounded border border-gray-300 bg-white hover:border-blue-500 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                  >
                    <Checkbox.Indicator>
                      <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <label
                    htmlFor={`field-${field}`}
                    className="cursor-pointer text-sm text-gray-700"
                  >
                    {field}
                  </label>
                </div>
              ))}
            </div>
            {selectedFields.length > 0 && (
              <p className="text-xs text-gray-500">{selectedFields.length} câmp(uri) selectat(e)</p>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Adăugați filtre pentru a rafina datele:</p>
              <button
                onClick={addFilter}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Adaugă Filtru
              </button>
            </div>
            <div className="max-h-[300px] space-y-3 overflow-y-auto">
              {filters.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nu există filtre. Apăsați &ldquo;Adaugă Filtru&rdquo; pentru a crea unul.
                </p>
              ) : (
                filters.map((filter, index) => (
                  <div key={index} className="flex gap-2 rounded-md border border-gray-200 p-3">
                    <Select.Root
                      value={filter.field}
                      onValueChange={(v) => updateFilter(index, 'field', v)}
                    >
                      <Select.Trigger className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                        <Select.Value placeholder="Câmp..." />
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Content className="rounded-md border border-gray-200 bg-white shadow-lg">
                          <Select.Viewport className="p-1">
                            {selectedFields.map((field) => (
                              <Select.Item
                                key={field}
                                value={field}
                                className="rounded px-2 py-1.5 text-sm hover:bg-blue-50"
                              >
                                <Select.ItemText>{field}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>

                    <Select.Root
                      value={filter.operator}
                      onValueChange={(v) => updateFilter(index, 'operator', v)}
                    >
                      <Select.Trigger className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Content className="rounded-md border border-gray-200 bg-white shadow-lg">
                          <Select.Viewport className="p-1">
                            {FILTER_OPERATORS.map((op) => (
                              <Select.Item
                                key={op.value}
                                value={op.value}
                                className="rounded px-2 py-1.5 text-sm hover:bg-blue-50"
                              >
                                <Select.ItemText>{op.label}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>

                    <input
                      type="text"
                      value={filter.value as string}
                      onChange={(e) => updateFilter(index, 'value', e.target.value)}
                      placeholder="Valoare..."
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />

                    <button
                      onClick={() => removeFilter(index)}
                      className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Selectați un câmp pentru grupare (opțional):</p>
            <Select.Root value={groupBy} onValueChange={setGroupBy}>
              <Select.Trigger className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                <Select.Value placeholder="Fără grupare" />
                <Select.Icon>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                  <Select.Viewport className="p-1">
                    <Select.Item value="" className="rounded px-8 py-2 text-sm hover:bg-blue-50">
                      <Select.ItemText>Fără grupare</Select.ItemText>
                    </Select.Item>
                    {selectedFields.map((field) => (
                      <Select.Item
                        key={field}
                        value={field}
                        className="rounded px-8 py-2 text-sm hover:bg-blue-50"
                      >
                        <Select.ItemText>{field}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Alegeți tipul de vizualizare:</p>
            <div className="grid grid-cols-2 gap-3">
              {CHART_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setChartType(type.value)}
                  className={`rounded-lg border-2 p-4 text-left transition-colors ${
                    chartType === type.value
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">{type.label}</div>
                </button>
              ))}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900">Previzualizare Raport</p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-semibold">Nume:</span> {reportName || 'Raport Personalizat'}
                </div>
                <div>
                  <span className="font-semibold">Sursă Date:</span>{' '}
                  {DATA_SOURCES.find((s) => s.value === dataSource)?.label}
                </div>
                <div>
                  <span className="font-semibold">Câmpuri:</span>{' '}
                  {selectedFields.join(', ') || 'Niciunul'}
                </div>
                <div>
                  <span className="font-semibold">Filtre:</span> {filters.length} filtru(e)
                </div>
                <div>
                  <span className="font-semibold">Grupare:</span> {groupBy || 'Fără grupare'}
                </div>
                <div>
                  <span className="font-semibold">Vizualizare:</span>{' '}
                  {CHART_TYPES.find((t) => t.value === chartType)?.label}
                </div>
              </div>
            </div>
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-sm text-gray-500">Previzualizare grafic / tabel</p>
              <p className="mt-2 text-xs text-gray-400">
                Datele vor fi generate după salvarea raportului
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[700px] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="flex flex-col">
            {/* Header with Stepper */}
            <div className="border-b border-gray-200 px-6 py-4">
              <Dialog.Title className="text-xl font-semibold text-gray-900">
                Creare Raport Personalizat
              </Dialog.Title>
              <div className="mt-4 flex items-center justify-between">
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                  <div key={step} className="flex flex-1 items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                        step === currentStep
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : step < currentStep
                            ? 'border-green-600 bg-green-600 text-white'
                            : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {step < currentStep ? '✓' : step}
                    </div>
                    {step < totalSteps && (
                      <div
                        className={`mx-1 h-0.5 flex-1 ${
                          step < currentStep ? 'bg-green-600' : 'bg-gray-300'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[50vh] overflow-y-auto px-6 py-6">{renderStepContent()}</div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4">
              <div className="flex justify-between">
                <button
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Înapoi
                </button>
                <div className="flex gap-2">
                  {currentStep === totalSteps ? (
                    <button
                      onClick={handleSaveReport}
                      className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Salvează Raport
                    </button>
                  ) : (
                    <button
                      onClick={handleNext}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Următorul
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
