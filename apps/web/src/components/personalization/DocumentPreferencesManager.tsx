/**
 * DocumentPreferencesManager - Manage document structure preferences
 * Story 5.6: AI Learning and Personalization (Task 33)
 * Configure section ordering, headers, and formatting per document type
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useDocumentPreferenceManagement,
  getDefaultSections,
  getDefaultHeaderStyle,
  getAvailableDocumentTypes,
  formatDocumentType,
  type DocumentSection,
  type HeaderStyle,
  type DocumentStructureInput,
} from '@/hooks/useDocumentPreferences';
import type { DocumentStructurePreference } from '@legal-platform/types';

// Icons
const DocumentIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const EditIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

const DeleteIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const MoveUpIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 15l7-7 7 7"
    />
  </svg>
);

const MoveDownIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

const PlusIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v16m8-8H4"
    />
  </svg>
);

interface DocumentPreferencesManagerProps {
  className?: string;
}

/**
 * Section editor component
 */
function SectionEditor({
  sections,
  onSectionsChange,
}: {
  sections: DocumentSection[];
  onSectionsChange: (sections: DocumentSection[]) => void;
}) {
  const [newSectionName, setNewSectionName] = useState('');

  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => a.order - b.order);
  }, [sections]);

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const newSections = [...sortedSections];
      const currentOrder = newSections[index].order;
      const prevOrder = newSections[index - 1].order;
      newSections[index] = { ...newSections[index], order: prevOrder };
      newSections[index - 1] = { ...newSections[index - 1], order: currentOrder };
      onSectionsChange(newSections);
    },
    [sortedSections, onSectionsChange]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index === sortedSections.length - 1) return;
      const newSections = [...sortedSections];
      const currentOrder = newSections[index].order;
      const nextOrder = newSections[index + 1].order;
      newSections[index] = { ...newSections[index], order: nextOrder };
      newSections[index + 1] = { ...newSections[index + 1], order: currentOrder };
      onSectionsChange(newSections);
    },
    [sortedSections, onSectionsChange]
  );

  const handleToggleRequired = useCallback(
    (index: number) => {
      const newSections = [...sortedSections];
      newSections[index] = {
        ...newSections[index],
        required: !newSections[index].required,
      };
      onSectionsChange(newSections);
    },
    [sortedSections, onSectionsChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const newSections = sortedSections.filter((_, i) => i !== index);
      // Reorder remaining sections
      const reordered = newSections.map((s, i) => ({ ...s, order: i + 1 }));
      onSectionsChange(reordered);
    },
    [sortedSections, onSectionsChange]
  );

  const handleAddSection = useCallback(() => {
    if (!newSectionName.trim()) return;
    const newSection: DocumentSection = {
      name: newSectionName.trim(),
      order: sections.length + 1,
      required: false,
    };
    onSectionsChange([...sections, newSection]);
    setNewSectionName('');
  }, [newSectionName, sections, onSectionsChange]);

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Secțiuni</div>
      <div className="space-y-2">
        {sortedSections.map((section, index) => (
          <div
            key={`${section.name}-${section.order}`}
            className="flex items-center gap-2 p-2 border rounded-md bg-muted/30"
          >
            <div className="flex flex-col gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                aria-label="Mută în sus"
              >
                <MoveUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => handleMoveDown(index)}
                disabled={index === sortedSections.length - 1}
                aria-label="Mută în jos"
              >
                <MoveDownIcon />
              </Button>
            </div>
            <span className="flex-1 text-sm">{section.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleToggleRequired(index)}
              className={section.required ? 'text-primary' : 'text-muted-foreground'}
              title={section.required ? 'Obligatoriu' : 'Opțional'}
            >
              {section.required ? 'Obligatoriu' : 'Opțional'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemove(index)}
              className="text-destructive hover:text-destructive"
              aria-label="Șterge secțiunea"
            >
              <DeleteIcon />
            </Button>
          </div>
        ))}
      </div>

      {/* Add section */}
      <div className="flex gap-2">
        <Input
          value={newSectionName}
          onChange={(e) => setNewSectionName(e.target.value)}
          placeholder="Nume secțiune nouă..."
          className="flex-1"
          onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddSection}
          disabled={!newSectionName.trim()}
        >
          <PlusIcon />
          Adaugă
        </Button>
      </div>
    </div>
  );
}

/**
 * Header style editor
 */
function HeaderStyleEditor({
  headerStyle,
  onHeaderStyleChange,
}: {
  headerStyle: HeaderStyle;
  onHeaderStyleChange: (style: HeaderStyle) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">Stil antet</div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground" htmlFor="format">
            Format
          </label>
          <select
            id="format"
            value={headerStyle.format}
            onChange={(e) =>
              onHeaderStyleChange({
                ...headerStyle,
                format: e.target.value as HeaderStyle['format'],
              })
            }
            className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="numbered">Numerotat</option>
            <option value="bulleted">Cu puncte</option>
            <option value="plain">Simplu</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground" htmlFor="numbering">
            Numerotare
          </label>
          <select
            id="numbering"
            value={headerStyle.numbering}
            onChange={(e) =>
              onHeaderStyleChange({
                ...headerStyle,
                numbering: e.target.value as HeaderStyle['numbering'],
              })
            }
            className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={headerStyle.format !== 'numbered'}
          >
            <option value="decimal">1, 2, 3...</option>
            <option value="roman">I, II, III...</option>
            <option value="alpha">A, B, C...</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={headerStyle.includeDate}
            onChange={(e) =>
              onHeaderStyleChange({ ...headerStyle, includeDate: e.target.checked })
            }
            className="rounded border-gray-300"
          />
          <span className="text-sm">Include data</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={headerStyle.includeAuthor}
            onChange={(e) =>
              onHeaderStyleChange({ ...headerStyle, includeAuthor: e.target.checked })
            }
            className="rounded border-gray-300"
          />
          <span className="text-sm">Include autor</span>
        </label>
      </div>
    </div>
  );
}

/**
 * Preview panel
 */
function PreviewPanel({
  sections,
  headerStyle,
  footerContent,
}: {
  sections: DocumentSection[];
  headerStyle: HeaderStyle;
  footerContent?: string;
}) {
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  const formatNumber = (index: number): string => {
    if (headerStyle.format !== 'numbered') return '';
    switch (headerStyle.numbering) {
      case 'roman':
        return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][index] || `${index + 1}`;
      case 'alpha':
        return String.fromCharCode(65 + index);
      default:
        return `${index + 1}`;
    }
  };

  const getBullet = (): string => {
    switch (headerStyle.format) {
      case 'bulleted':
        return '•';
      case 'numbered':
        return '';
      default:
        return '';
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white dark:bg-gray-900 min-h-[300px]">
      {/* Header */}
      <div className="border-b pb-2 mb-4 text-xs text-muted-foreground">
        {headerStyle.includeDate && <span>Data: ___/___/_____</span>}
        {headerStyle.includeDate && headerStyle.includeAuthor && ' | '}
        {headerStyle.includeAuthor && <span>Autor: _____________</span>}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {sortedSections.map((section, index) => (
          <div key={section.name} className="text-sm">
            <div className="font-medium">
              {headerStyle.format === 'numbered' && `${formatNumber(index)}. `}
              {headerStyle.format === 'bulleted' && `${getBullet()} `}
              {section.name}
              {section.required && <span className="text-red-500 ml-1">*</span>}
            </div>
            <div className="ml-4 text-muted-foreground text-xs">
              [Conținut secțiune...]
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {footerContent && (
        <div className="border-t pt-2 mt-4 text-xs text-muted-foreground">
          {footerContent}
        </div>
      )}
    </div>
  );
}

/**
 * Preference editor dialog
 */
function PreferenceEditorDialog({
  preference,
  documentType,
  open,
  onClose,
  onSave,
  loading,
}: {
  preference: DocumentStructurePreference | null;
  documentType: string;
  open: boolean;
  onClose: () => void;
  onSave: (input: DocumentStructureInput) => Promise<void>;
  loading: boolean;
}) {
  const [sections, setSections] = useState<DocumentSection[]>(
    (preference?.preferredSections as unknown as DocumentSection[]) || getDefaultSections(documentType)
  );
  const [headerStyle, setHeaderStyle] = useState<HeaderStyle>(
    (preference?.headerStyle as unknown as HeaderStyle) || getDefaultHeaderStyle()
  );
  const [footerContent, setFooterContent] = useState(preference?.footerContent || '');

  // Reset state when preference changes
  React.useEffect(() => {
    if (open) {
      setSections(
        (preference?.preferredSections as unknown as DocumentSection[]) || getDefaultSections(documentType)
      );
      setHeaderStyle((preference?.headerStyle as unknown as HeaderStyle) || getDefaultHeaderStyle());
      setFooterContent(preference?.footerContent || '');
    }
  }, [preference, documentType, open]);

  const handleSave = async () => {
    await onSave({
      documentType,
      sections,
      headerStyle,
      footerContent: footerContent || undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {preference ? 'Editează' : 'Configurează'} preferințe -{' '}
            {formatDocumentType(documentType)}
          </DialogTitle>
          <DialogDescription>
            Personalizează structura și formatarea documentelor de tip{' '}
            {formatDocumentType(documentType)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 py-4">
          {/* Left: Settings */}
          <div className="space-y-6">
            <SectionEditor sections={sections} onSectionsChange={setSections} />

            <HeaderStyleEditor
              headerStyle={headerStyle}
              onHeaderStyleChange={setHeaderStyle}
            />

            <div>
              <label className="text-sm font-medium" htmlFor="footerContent">
                Conținut subsol (opțional)
              </label>
              <textarea
                id="footerContent"
                value={footerContent}
                onChange={(e) => setFooterContent(e.target.value)}
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                placeholder="ex: Confidențial - Doar pentru uz intern"
              />
            </div>
          </div>

          {/* Right: Preview */}
          <div>
            <div className="text-sm font-medium mb-2">Previzualizare</div>
            <PreviewPanel
              sections={sections}
              headerStyle={headerStyle}
              footerContent={footerContent}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Anulează
          </Button>
          <Button onClick={handleSave} disabled={loading || sections.length === 0}>
            {loading ? 'Se salvează...' : 'Salvează'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Main DocumentPreferencesManager component
 */
export function DocumentPreferencesManager({
  className = '',
}: DocumentPreferencesManagerProps) {
  const {
    preferences,
    configuredTypes,
    loading,
    error,
    saving,
    deleting,
    savePreference,
    deletePreference,
    count,
  } = useDocumentPreferenceManagement();

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<string | null>(null);

  const availableTypes = getAvailableDocumentTypes();
  const unconfiguredTypes = availableTypes.filter(
    (type) => !configuredTypes.includes(type)
  );

  const selectedPreference = useMemo(() => {
    if (!selectedType) return null;
    return preferences.find((p: DocumentStructurePreference) => p.documentType === selectedType) || null;
  }, [selectedType, preferences]);

  const handleEdit = (type: string) => {
    setSelectedType(type);
    setEditorOpen(true);
  };

  const handleAddNew = (type: string) => {
    setSelectedType(type);
    setEditorOpen(true);
  };

  const handleDelete = (type: string) => {
    setTypeToDelete(type);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!typeToDelete) return;
    await deletePreference(typeToDelete);
    setDeleteDialogOpen(false);
    setTypeToDelete(null);
  };

  const handleSave = async (input: DocumentStructureInput) => {
    await savePreference(input);
  };

  if (loading && preferences.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-muted-foreground">
              Se încarcă preferințele...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <p>Eroare la încărcarea preferințelor</p>
            <p className="text-sm">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DocumentIcon className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Preferințe Documente</CardTitle>
              <p className="text-sm text-muted-foreground">
                {count} tipuri de documente configurate
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="configured" className="space-y-4">
            <TabsList>
              <TabsTrigger value="configured">
                Configurate ({configuredTypes.length})
              </TabsTrigger>
              <TabsTrigger value="available">
                Disponibile ({unconfiguredTypes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="configured" className="space-y-3">
              {configuredTypes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DocumentIcon className="mx-auto mb-3 h-12 w-12 opacity-50" />
                  <p>Nu există preferințe configurate încă</p>
                  <p className="text-sm mt-1">
                    Selectează un tip de document din tabul &ldquo;Disponibile&rdquo;
                  </p>
                </div>
              ) : (
                preferences.map((pref: DocumentStructurePreference) => (
                  <div
                    key={pref.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatDocumentType(pref.documentType)}
                        </span>
                        <Badge variant="secondary">
                          {(pref.preferredSections as DocumentSection[])?.length || 0} secțiuni
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Folosit de {pref.usageCount} ori
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(pref.documentType)}
                      >
                        <EditIcon />
                        Editează
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(pref.documentType)}
                        className="text-destructive hover:text-destructive"
                      >
                        <DeleteIcon />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="available" className="space-y-3">
              {unconfiguredTypes.map((type) => (
                <div
                  key={type}
                  className="flex items-center justify-between p-3 border rounded-lg border-dashed"
                >
                  <span className="text-muted-foreground">
                    {formatDocumentType(type)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddNew(type)}
                  >
                    <PlusIcon />
                    Configurează
                  </Button>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      {selectedType && (
        <PreferenceEditorDialog
          preference={selectedPreference}
          documentType={selectedType}
          open={editorOpen}
          onClose={() => {
            setEditorOpen(false);
            setSelectedType(null);
          }}
          onSave={handleSave}
          loading={saving}
        />
      )}

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(isOpen) => !isOpen && setDeleteDialogOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Șterge preferințele</DialogTitle>
            <DialogDescription>
              Ești sigur că vrei să ștergi preferințele pentru{' '}
              {typeToDelete ? formatDocumentType(typeToDelete) : ''}? Această
              acțiune nu poate fi anulată.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Anulează
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Se șterge...' : 'Șterge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

DocumentPreferencesManager.displayName = 'DocumentPreferencesManager';

/**
 * Compact card for dashboard widgets
 */
export function DocumentPreferencesCard({ className = '' }: { className?: string }) {
  const { configuredTypes, mostUsed, loading } = useDocumentPreferenceManagement();

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="animate-pulse h-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <DocumentIcon className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Preferințe Documente</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Tipuri configurate</span>
          <span className="font-medium">{configuredTypes.length}</span>
        </div>

        {mostUsed && (
          <div className="text-xs text-muted-foreground">
            Cel mai folosit:{' '}
            <span className="font-medium">
              {formatDocumentType(mostUsed.documentType)}
            </span>{' '}
            ({mostUsed.usageCount} utilizări)
          </div>
        )}

        {configuredTypes.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nicio preferință configurată
          </p>
        )}
      </CardContent>
    </Card>
  );
}

DocumentPreferencesCard.displayName = 'DocumentPreferencesCard';
