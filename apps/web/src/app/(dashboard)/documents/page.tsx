'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useDocumentsStore } from '@/store/documentsStore';
import {
  DocumentsSidebar,
  DocumentsContentPanel,
  MapaDetail,
  CreateMapaModal,
  SlotAssignModal,
  RequestDocumentModal,
} from '@/components/documents';
import { useCases, useCaseDocuments, transformDocument } from '@/hooks/useDocuments';
import { useCancelDocumentRequest } from '@/hooks/useMapa';
import type { Document } from '@/types/document';
import type { Mapa, MapaSlot, DocumentRequest, CaseWithMape } from '@/types/mapa';

export default function DocumentsPage() {
  const { sidebarSelection, setSidebarSelection, selectedCaseId, setPreviewDocument } =
    useDocumentsStore();

  // Fetch cases from API
  const { cases: apiCases, loading: casesLoading } = useCases();

  // Fetch all mapas from API
  const [allMapas, setAllMapas] = useState<Mapa[]>([]);
  const [mapasVersion, setMapasVersion] = useState(0);

  useEffect(() => {
    async function fetchMapas() {
      try {
        const response = await fetch('/api/mapas');
        if (response.ok) {
          const data = await response.json();
          setAllMapas(data.mapas ?? []);
        }
      } catch (error) {
        console.error('Failed to fetch mapas:', error);
      }
    }
    fetchMapas();
  }, [mapasVersion]);

  // Get current case ID based on selection
  const currentCaseId = useMemo(() => {
    if (sidebarSelection.type === 'case') return sidebarSelection.caseId;
    return null;
  }, [sidebarSelection]);

  // Fetch documents for selected case
  const { documents: apiDocuments, loading: docsLoading } = useCaseDocuments(currentCaseId);

  // Transform API cases to CaseWithMape format for sidebar
  const cases = useMemo<CaseWithMape[]>(() => {
    return apiCases.map((c) => ({
      id: c.id,
      name: c.title,
      caseNumber: c.caseNumber,
      status: (c.status as 'Active' | 'PendingApproval' | 'OnHold' | 'Closed') || 'Active',
      documentCount: 0, // Will be populated when we have folder data
      mape: allMapas.filter((m) => m.caseId === c.id),
      unassignedDocumentCount: 0,
    }));
  }, [apiCases, allMapas]);

  // Modal state
  const [createMapaModalOpen, setCreateMapaModalOpen] = useState(false);
  const [createMapaCaseId, setCreateMapaCaseId] = useState<string | null>(null);
  const [slotAssignModalOpen, setSlotAssignModalOpen] = useState(false);
  const [selectedSlotForAssign, setSelectedSlotForAssign] = useState<MapaSlot | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedSlotForRequest, setSelectedSlotForRequest] = useState<MapaSlot | null>(null);

  // Hooks
  const { cancelRequest } = useCancelDocumentRequest();

  // Transform API documents to UI format
  const transformedDocs = useMemo(() => {
    if (!currentCaseId || !apiDocuments.length) return [];
    return apiDocuments.map((doc) => transformDocument(doc, currentCaseId));
  }, [apiDocuments, currentCaseId]);

  // Get documents based on sidebar selection
  const { documents, breadcrumb } = useMemo(() => {
    let docs: Document[] = [];
    let crumbs: { label: string; onClick?: () => void }[] = [];

    switch (sidebarSelection.type) {
      case 'all':
        // Show empty state prompting case selection when using real data
        docs = [];
        crumbs = [{ label: 'All Documents' }];
        break;
      case 'case': {
        docs = transformedDocs;
        const caseData = cases.find((c) => c.id === sidebarSelection.caseId);
        crumbs = [
          { label: 'All Documents', onClick: () => setSidebarSelection({ type: 'all' }) },
          { label: caseData?.name || 'Case' },
        ];
        break;
      }
      case 'mapa':
        // Mapa view - for now show case documents (would need mapa-specific query)
        docs = transformedDocs;
        crumbs = [
          { label: 'All Documents', onClick: () => setSidebarSelection({ type: 'all' }) },
          { label: 'Mapa' },
        ];
        break;
      case 'unassigned':
        docs = [];
        crumbs = [
          { label: 'All Documents', onClick: () => setSidebarSelection({ type: 'all' }) },
          { label: 'Unassigned Documents' },
        ];
        break;
      default:
        docs = [];
        crumbs = [{ label: 'All Documents' }];
    }

    return { documents: docs, breadcrumb: crumbs };
  }, [sidebarSelection, setSidebarSelection, transformedDocs, cases]);

  // Get review count (documents with PENDING status)
  const reviewCount = transformedDocs.filter((d) => d.status === 'PENDING').length;

  // Check if we're viewing a mapa detail
  const viewingMapa = useMemo(() => {
    if (sidebarSelection.type !== 'mapa') return null;
    // Find mapa directly in allMapas
    return allMapas.find((m) => m.id === sidebarSelection.mapaId) ?? null;
  }, [sidebarSelection, allMapas]);
  const viewingMapaCase = viewingMapa ? cases.find((c) => c.id === viewingMapa.caseId) : null;

  // Handlers
  const handleUpload = () => {
    console.log('Upload clicked');
    // TODO: Open upload modal
  };

  const handlePreviewDocument = (doc: Document) => {
    setPreviewDocument(doc.id);
    console.log('Preview document:', doc.fileName);
    // TODO: Open preview modal
  };

  const handleDownloadDocument = (doc: Document) => {
    console.log('Download document:', doc.fileName);
    // TODO: Implement download
  };

  const handleDeleteDocument = (doc: Document) => {
    console.log('Delete document:', doc.fileName);
    // TODO: Open delete confirmation
  };

  const handleAssignToMapa = (doc: Document) => {
    console.log('Assign to mapa:', doc.fileName);
    // TODO: Open assign modal
  };

  const handleCreateMapa = (caseId: string) => {
    setCreateMapaCaseId(caseId);
    setCreateMapaModalOpen(true);
  };

  const handleMapaCreated = useCallback(
    (mapa: Mapa) => {
      // Refresh mapas list to include the new one
      setMapasVersion((v) => v + 1);
      // Navigate to the newly created mapa
      setSidebarSelection({ type: 'mapa', mapaId: mapa.id });
    },
    [setSidebarSelection]
  );

  const handleAssignDocumentToSlot = (slotId: string) => {
    const mapa = viewingMapa;
    if (!mapa) return;
    const slot = mapa.slots.find((s) => s.id === slotId);
    if (slot) {
      setSelectedSlotForAssign(slot);
      setSlotAssignModalOpen(true);
    }
  };

  const handleSlotAssignSuccess = (slot: MapaSlot) => {
    console.log('Document assigned to slot:', slot);
    // TODO: Refetch mapa to update UI
  };

  const handleMapaUpdated = (mapa: Mapa) => {
    console.log('Mapa updated:', mapa);
    // TODO: Refetch mapa data
  };

  const handleMapaDeleted = () => {
    console.log('Mapa deleted');
    // Navigate back to the case
    if (viewingMapa) {
      setSidebarSelection({ type: 'case', caseId: viewingMapa.caseId });
    }
    // TODO: Refetch cases to update sidebar
  };

  const handleRequestDocument = (slotId: string) => {
    const mapa = viewingMapa;
    if (!mapa) return;
    const slot = mapa.slots.find((s) => s.id === slotId);
    if (slot) {
      setSelectedSlotForRequest(slot);
      setRequestModalOpen(true);
    }
  };

  const handleRequestSuccess = (request: DocumentRequest) => {
    console.log('Document request created:', request);
    // TODO: Refetch mapa to update UI
    setRequestModalOpen(false);
  };

  const handleCancelRequest = async (slotId: string) => {
    const mapa = viewingMapa;
    if (!mapa) return;
    const slot = mapa.slots.find((s) => s.id === slotId);
    if (slot?.documentRequest) {
      const result = await cancelRequest(slot.documentRequest.id);
      if (result) {
        console.log('Document request cancelled:', result);
        // TODO: Refetch mapa to update UI
      }
    }
  };

  return (
    <div className="flex flex-1 w-full overflow-hidden">
      {/* Sidebar */}
      <DocumentsSidebar cases={cases} onCreateMapa={handleCreateMapa} />

      {/* Main Content */}
      {viewingMapa && viewingMapaCase ? (
        <MapaDetail
          mapa={viewingMapa}
          caseName={viewingMapaCase.name}
          onBack={() => setSidebarSelection({ type: 'case', caseId: viewingMapa.caseId })}
          onAddSlot={() => console.log('Add slot')}
          onFinalize={() => console.log('Finalize mapa')}
          onAssignDocument={handleAssignDocumentToSlot}
          onRemoveDocument={(slotId) => console.log('Remove from slot:', slotId)}
          onViewDocument={(docId) => setPreviewDocument(docId)}
          onRequestDocument={handleRequestDocument}
          onCancelRequest={handleCancelRequest}
          onMapaUpdated={handleMapaUpdated}
          onMapaDeleted={handleMapaDeleted}
        />
      ) : (
        <DocumentsContentPanel
          documents={documents}
          breadcrumb={breadcrumb}
          reviewCount={reviewCount}
          onUpload={handleUpload}
          onPreviewDocument={handlePreviewDocument}
          onDownloadDocument={handleDownloadDocument}
          onDeleteDocument={handleDeleteDocument}
          onAssignToMapa={handleAssignToMapa}
        />
      )}

      {/* Create Mapa Modal */}
      {createMapaCaseId && (
        <CreateMapaModal
          open={createMapaModalOpen}
          onOpenChange={setCreateMapaModalOpen}
          caseId={createMapaCaseId}
          onSuccess={handleMapaCreated}
        />
      )}

      {/* Slot Assign Modal */}
      {selectedSlotForAssign && viewingMapa && (
        <SlotAssignModal
          open={slotAssignModalOpen}
          onOpenChange={setSlotAssignModalOpen}
          slot={selectedSlotForAssign}
          documents={transformedDocs}
          onSuccess={handleSlotAssignSuccess}
        />
      )}

      {/* Request Document Modal */}
      {selectedSlotForRequest && (
        <RequestDocumentModal
          open={requestModalOpen}
          onOpenChange={setRequestModalOpen}
          slot={selectedSlotForRequest}
          onSuccess={handleRequestSuccess}
        />
      )}
    </div>
  );
}
