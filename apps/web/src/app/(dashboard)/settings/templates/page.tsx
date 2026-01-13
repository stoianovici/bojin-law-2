'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { FileText, Upload, Check, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { GET_FIRM_DOCUMENT_TEMPLATE } from '@/graphql/queries';
import { UPLOAD_FIRM_DOCUMENT_TEMPLATE } from '@/graphql/mutations';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';

// ============================================================================
// Types
// ============================================================================

interface FirmDocumentTemplate {
  url: string;
  driveItemId: string;
  fileName: string;
  updatedAt: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:application/...;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// Page Component
// ============================================================================

export default function TemplateSettingsPage() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only admins (Partners/BusinessOwners) can access this page
  const isAdmin = user?.role === 'ADMIN';

  const { data, loading, refetch } = useQuery<{
    firmDocumentTemplate: FirmDocumentTemplate | null;
  }>(GET_FIRM_DOCUMENT_TEMPLATE, { skip: !isAdmin });

  const [uploadTemplate] = useMutation(UPLOAD_FIRM_DOCUMENT_TEMPLATE, {
    onCompleted: () => {
      setSuccess(true);
      setError(null);
      refetch();
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess(false);
      setUploading(false);
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type (.dotx or .docx template)
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(dotx|docx)$/i)) {
      setError('Va rugam sa selectati un fisier .dotx sau .docx');
      return;
    }

    // Check file size (max 50MB for templates)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Fisierul este prea mare. Limita este de 50MB.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Convert file to base64
      const fileContent = await fileToBase64(file);

      // Determine file type
      const fileType =
        file.type ||
        (file.name.endsWith('.dotx')
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.template'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

      // Upload to SharePoint via GraphQL mutation
      await uploadTemplate({
        variables: {
          input: {
            fileName: file.name,
            fileType,
            fileContent,
          },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la incarcarea fisierului');
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // ============================================================================
  // Render: Access Denied
  // ============================================================================

  if (!isAdmin) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-2 text-linear-text-muted">
          <AlertCircle className="w-5 h-5" />
          <span>Nu aveti permisiunea de a accesa aceasta pagina.</span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render: Main Content
  // ============================================================================

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-linear-text-primary">Template Documente</h1>
        <p className="text-base text-linear-text-muted mt-1">
          Configurati template-ul master Word pentru documentele firmei
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Template Master Word
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-linear-text-secondary">
            Incarcati un fisier .dotx sau .docx care va fi folosit ca baza pentru toate documentele
            noi create in firma. Template-ul ar trebui sa contina antetul, subsolul si stilurile
            brandului firmei.
          </p>

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center gap-2 text-linear-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Se incarca...</span>
            </div>
          ) : data?.firmDocumentTemplate ? (
            /* Template Exists */
            <div className="bg-linear-bg-elevated rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-linear-accent" />
                <span className="font-medium text-linear-text-primary">
                  {data.firmDocumentTemplate.fileName}
                </span>
              </div>
              {data.firmDocumentTemplate.updatedAt && (
                <p className="text-sm text-linear-text-tertiary">
                  Actualizat{' '}
                  {formatDistanceToNow(new Date(data.firmDocumentTemplate.updatedAt), {
                    addSuffix: true,
                    locale: ro,
                  })}
                </p>
              )}
            </div>
          ) : (
            /* No Template */
            <div className="bg-linear-bg-elevated rounded-lg p-4">
              <p className="text-sm text-linear-text-tertiary">
                Nu exista un template configurat. Documentele noi vor fi create goale.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-linear-error bg-linear-error/10 px-3 py-2 rounded-md">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 text-linear-success bg-linear-success/10 px-3 py-2 rounded-md">
              <Check className="w-4 h-4" />
              <span className="text-sm">Template actualizat cu succes!</span>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex items-center gap-3">
            <Button
              variant={data?.firmDocumentTemplate ? 'secondary' : 'primary'}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Se incarca...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {data?.firmDocumentTemplate ? 'Inlocuieste template' : 'Incarca template'}
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".dotx,.docx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </div>

          {/* Info about Word add-in */}
          <div className="mt-6 p-4 bg-linear-bg-secondary rounded-lg border border-linear-border-subtle">
            <h4 className="text-sm font-medium text-linear-text-primary mb-2">
              Cum functioneaza cu Word Add-in
            </h4>
            <ul className="text-sm text-linear-text-secondary space-y-1 list-disc list-inside">
              <li>Documentele noi create din platforma vor folosi acest template</li>
              <li>
                Stilurile definite in template (Heading1, Quote, etc.) vor fi aplicate automat
              </li>
              <li>
                Pentru stiluri personalizate (DateLocation, PartyDefinition), definiti-le in
                template
              </li>
              <li>Documentele existente nu vor fi afectate</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
