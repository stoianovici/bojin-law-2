'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { Button, Input, Switch, Card, CardContent } from '@/components/ui';
import { GET_OBLIO_CONFIG } from '@/graphql/queries';
import { SAVE_OBLIO_CONFIG, TEST_OBLIO_CONNECTION } from '@/graphql/mutations';
import { CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';

interface OblioConfig {
  email: string;
  companyCif: string;
  defaultSeries: string;
  workStation: string | null;
  isVatPayer: boolean;
  defaultVatRate: number;
  defaultDueDays: number;
  exchangeRateSource: string;
  autoSubmitEFactura: boolean;
  isConfigured: boolean;
  lastTestedAt: string | null;
}

export function OblioSettings() {
  const [formData, setFormData] = useState({
    email: '',
    secret: '',
    companyCif: '',
    defaultSeries: '',
    workStation: '',
    isVatPayer: true,
    defaultVatRate: 19,
    defaultDueDays: 30,
    exchangeRateSource: 'BNR',
    autoSubmitEFactura: false,
  });
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data, loading } = useQuery<{ oblioConfig: OblioConfig | null }>(GET_OBLIO_CONFIG);

  const [saveConfig, { loading: saving }] = useMutation(SAVE_OBLIO_CONFIG, {
    refetchQueries: [{ query: GET_OBLIO_CONFIG }],
  });

  const [testConnection, { loading: testing }] = useMutation(TEST_OBLIO_CONNECTION);

  useEffect(() => {
    if (data?.oblioConfig) {
      setFormData((prev) => ({
        ...prev,
        email: data.oblioConfig!.email,
        companyCif: data.oblioConfig!.companyCif,
        defaultSeries: data.oblioConfig!.defaultSeries,
        workStation: data.oblioConfig!.workStation || '',
        isVatPayer: data.oblioConfig!.isVatPayer,
        defaultVatRate: data.oblioConfig!.defaultVatRate,
        defaultDueDays: data.oblioConfig!.defaultDueDays,
        exchangeRateSource: data.oblioConfig!.exchangeRateSource,
        autoSubmitEFactura: data.oblioConfig!.autoSubmitEFactura,
        // Don't overwrite secret - it's not returned from the server
      }));
    }
  }, [data]);

  const handleSave = async () => {
    try {
      await saveConfig({
        variables: {
          input: {
            email: formData.email,
            secret: formData.secret,
            companyCif: formData.companyCif,
            defaultSeries: formData.defaultSeries,
            workStation: formData.workStation || null,
            isVatPayer: formData.isVatPayer,
            defaultVatRate: formData.defaultVatRate,
            defaultDueDays: formData.defaultDueDays,
            exchangeRateSource: formData.exchangeRateSource,
            autoSubmitEFactura: formData.autoSubmitEFactura,
          },
        },
      });
      setFormData((prev) => ({ ...prev, secret: '' }));
      setTestResult({ success: true, message: 'Configurația a fost salvată cu succes' });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Eroare la salvare',
      });
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const result = await testConnection();
      const testData = result.data as
        | { testOblioConnection: { success: boolean; message: string } }
        | undefined;
      if (testData?.testOblioConnection) {
        setTestResult(testData.testOblioConnection);
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Eroare la testare',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-linear-text-muted" />
      </div>
    );
  }

  const isConfigured = data?.oblioConfig?.isConfigured;

  return (
    <div className="space-y-6">
      {/* Status indicator */}
      {isConfigured && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-linear-text-muted">
            Configurat
            {data?.oblioConfig?.lastTestedAt && (
              <>
                {' '}
                · Ultima testare:{' '}
                {new Date(data.oblioConfig.lastTestedAt).toLocaleDateString('ro-RO')}
              </>
            )}
          </span>
        </div>
      )}

      {/* Credentials */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h4 className="text-sm font-medium text-linear-text-primary">Credențiale API</h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-linear-text-primary">
                Email Oblio
              </label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplu.ro"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="secret" className="text-sm font-medium text-linear-text-primary">
                Secret API
              </label>
              <div className="relative">
                <Input
                  id="secret"
                  type={showSecret ? 'text' : 'password'}
                  placeholder={isConfigured ? '••••••••' : 'Secret API'}
                  value={formData.secret}
                  onChange={(e) => setFormData((prev) => ({ ...prev, secret: e.target.value }))}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-linear-text-muted hover:text-linear-text-primary"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-linear-text-muted">
                {isConfigured
                  ? 'Lasă gol pentru a păstra secretul existent'
                  : 'Găsești secretul în contul Oblio'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="companyCif" className="text-sm font-medium text-linear-text-primary">
                CIF Companie
              </label>
              <Input
                id="companyCif"
                placeholder="RO12345678"
                value={formData.companyCif}
                onChange={(e) => setFormData((prev) => ({ ...prev, companyCif: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="defaultSeries"
                className="text-sm font-medium text-linear-text-primary"
              >
                Serie Facturi
              </label>
              <Input
                id="defaultSeries"
                placeholder="BJ"
                value={formData.defaultSeries}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, defaultSeries: e.target.value }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Settings */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h4 className="text-sm font-medium text-linear-text-primary">Setări Facturare</h4>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="defaultVatRate"
                className="text-sm font-medium text-linear-text-primary"
              >
                Cotă TVA (%)
              </label>
              <Input
                id="defaultVatRate"
                type="number"
                min="0"
                max="100"
                value={formData.defaultVatRate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    defaultVatRate: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="defaultDueDays"
                className="text-sm font-medium text-linear-text-primary"
              >
                Scadență (zile)
              </label>
              <Input
                id="defaultDueDays"
                type="number"
                min="1"
                max="365"
                value={formData.defaultDueDays}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    defaultDueDays: parseInt(e.target.value) || 30,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="workStation" className="text-sm font-medium text-linear-text-primary">
                Punct de lucru
              </label>
              <Input
                id="workStation"
                placeholder="Opțional"
                value={formData.workStation}
                onChange={(e) => setFormData((prev) => ({ ...prev, workStation: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm text-linear-text-primary">Plătitor de TVA</p>
              <p className="text-xs text-linear-text-muted">
                Firma este înregistrată ca plătitor de TVA
              </p>
            </div>
            <Switch
              checked={formData.isVatPayer}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, isVatPayer: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-linear-text-primary">e-Factura automat</p>
              <p className="text-xs text-linear-text-muted">Trimite automat facturile la ANAF</p>
            </div>
            <Switch
              checked={formData.autoSubmitEFactura}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, autoSubmitEFactura: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Test result */}
      {testResult && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            testResult.success
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
          }`}
        >
          {testResult.success ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {testResult.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !formData.email || !formData.companyCif}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Salvează
        </Button>
        <Button variant="secondary" onClick={handleTest} disabled={testing || !isConfigured}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Testează conexiunea
        </Button>
      </div>
    </div>
  );
}
