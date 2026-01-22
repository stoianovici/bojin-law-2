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
  AddSlotModal,
  UploadDocumentModal,
  CreateDocumentModal,
  RenameDocumentModal,
  DeleteDocumentModal,
  AssignToMapaModal,
} from '@/components/documents';
import {
  useCases,
  useCaseDocuments,
  useClientInboxDocuments,
  transformDocument,
} from '@/hooks/useDocuments';
import { useCancelDocumentRequest, useMapas } from '@/hooks/useMapa';
import { apolloClient } from '@/lib/apollo-client';
import { GET_MAPAS, GET_CLIENT_MAPAS } from '@/graphql/mapa';
import { GET_CASE_DOCUMENT_COUNTS, GET_CLIENTS_WITH_INBOX_DOCUMENTS } from '@/graphql/queries';
import { useDocumentPreview } from '@/hooks/useDocumentPreview';
import { useAuth } from '@/hooks/useAuth';
import { isAssociateOrAbove } from '@/store/authStore';
import { useUserPreferences } from '@/hooks/useSettings';
import { useQuery, useMutation } from '@apollo/client/react';
import { MARK_DOCUMENT_FINAL, MARK_DOCUMENT_READY_FOR_REVIEW } from '@/graphql/mutations';
import type { Document } from '@/types/document';
import type { Mapa, MapaSlot, DocumentRequest, CaseWithMape } from '@/types/mapa';

// GraphQL returns nested document structure (CaseDocumentWithContext.document)
// but frontend types expect flattened structure (slot.document = Document)
// This function transforms the GraphQL response to match frontend types
interface GraphQLMapaSlot extends Omit<MapaSlot, 'document'> {
  document?: {
    id: string;
    document: Document & { fileType: string }; // Raw fileType from GraphQL
  } | null;
}

interface GraphQLMapa extends Omit<Mapa, 'slots'> {
  slots: GraphQLMapaSlot[];
}

// Convert raw fileType (MIME type or extension) to simplified FileType enum
function normalizeFileType(
  mimeOrExt: string | undefined
): 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'other' {
  if (!mimeOrExt) return 'other';
  const lower = mimeOrExt.toLowerCase();
  if (lower.includes('pdf')) return 'pdf';
  if (lower.includes('word') || lower.includes('docx') || lower.includes('doc')) return 'docx';
  if (lower.includes('excel') || lower.includes('xlsx') || lower.includes('xls')) return 'xlsx';
  if (lower.includes('powerpoint') || lower.includes('pptx') || lower.includes('ppt'))
    return 'pptx';
  if (
    lower.includes('image') ||
    lower.includes('png') ||
    lower.includes('jpg') ||
    lower.includes('jpeg') ||
    lower.includes('gif') ||
    lower.includes('webp')
  )
    return 'image';
  return 'other';
}

function transformMapaFromGraphQL(mapa: GraphQLMapa): Mapa {
  return {
    ...mapa,
    slots: mapa.slots.map((slot) => ({
      ...slot,
      // Flatten nested document structure and normalize fileType
      document: slot.document?.document
        ? {
            ...slot.document.document,
            fileType: normalizeFileType(slot.document.document.fileType),
          }
        : undefined,
    })),
  };
}

export default function DocumentsPage() {
  const { sidebarSelection, setSidebarSelection, setPreviewDocument, selectedCaseId } =
    useDocumentsStore();
  const { user } = useAuth();

  // Fetch cases from API
  const { cases: apiCases } = useCases();

  // Fetch document counts for all cases
  const { data: documentCountsData } = useQuery<{
    caseDocumentCounts: Array<{ caseId: string; documentCount: number }>;
  }>(GET_CASE_DOCUMENT_COUNTS, {
    fetchPolicy: 'cache-and-network',
  });

  // Create a map for quick lookup of document counts
  const documentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    documentCountsData?.caseDocumentCounts?.forEach((item) => {
      map.set(item.caseId, item.documentCount);
    });
    return map;
  }, [documentCountsData]);

  // Fetch clients with inbox documents (documents not assigned to any case)
  const { data: clientsInboxData } = useQuery<{
    clientsWithInboxDocuments: Array<{
      clientId: string;
      clientName: string;
      inboxDocumentCount: number;
    }>;
  }>(GET_CLIENTS_WITH_INBOX_DOCUMENTS, {
    fetchPolicy: 'cache-and-network',
  });

  // Transform to sidebar format
  const clientsWithDocuments = useMemo(() => {
    return (
      clientsInboxData?.clientsWithInboxDocuments?.map((c) => ({
        id: c.clientId,
        name: c.clientName,
        activeCasesCount: 0,
        activeCases: [],
        documentCount: c.inboxDocumentCount,
      })) ?? []
    );
  }, [clientsInboxData]);

  // Get selected client ID if in client inbox mode
  const selectedClientIdForInbox =
    sidebarSelection.type === 'clientInbox' ? sidebarSelection.clientId : null;

  // Fetch all mapas from API (both case-level and client-level)
  const [allMapas, setAllMapas] = useState<Mapa[]>([]);
  const [clientMapas, setClientMapas] = useState<Mapa[]>([]);
  const [mapasVersion, setMapasVersion] = useState(0);

  // Fetch mapas from GraphQL for all cases
  // Use JSON.stringify of case IDs as stable dependency
  const caseIds = useMemo(() => apiCases.map((c) => c.id), [apiCases]);
  const caseIdsKey = JSON.stringify(caseIds);

  useEffect(() => {
    async function fetchMapasForAllCases() {
      if (!caseIds.length) return;

      try {
        // Fetch mapas for each case in parallel
        const mapaPromises = caseIds.map(async (caseId) => {
          try {
            const result = await apolloClient.query<{ caseMape: GraphQLMapa[] }>({
              query: GET_MAPAS,
              variables: { caseId },
              fetchPolicy: 'network-only',
            });
            // Transform nested document structure to flat structure
            return (result.data?.caseMape ?? []).map(transformMapaFromGraphQL);
          } catch (err) {
            console.error(`Failed to fetch mapas for case ${caseId}:`, err);
            return [];
          }
        });

        const mapasPerCase = await Promise.all(mapaPromises);
        const allFetchedMapas = mapasPerCase.flat();
        setAllMapas(allFetchedMapas);
      } catch (error) {
        console.error('Failed to fetch mapas:', error);
      }
    }
    fetchMapasForAllCases();
  }, [caseIdsKey, mapasVersion]);

  // Get unique client IDs from cases and clientsWithDocuments
  const clientIds = useMemo(() => {
    const ids = new Set<string>();
    apiCases.forEach((c) => {
      if (c.client?.id) ids.add(c.client.id);
    });
    clientsWithDocuments.forEach((c) => {
      if (c.id) ids.add(c.id);
    });
    return Array.from(ids);
  }, [apiCases, clientsWithDocuments]);
  const clientIdsKey = JSON.stringify(clientIds);

  // Fetch client-level mapas
  useEffect(() => {
    async function fetchClientMapas() {
      if (!clientIds.length) return;

      try {
        const mapaPromises = clientIds.map(async (clientId) => {
          try {
            const result = await apolloClient.query<{ clientMape: GraphQLMapa[] }>({
              query: GET_CLIENT_MAPAS,
              variables: { clientId },
              fetchPolicy: 'network-only',
            });
            // Transform nested document structure to flat structure
            return (result.data?.clientMape ?? []).map(transformMapaFromGraphQL);
          } catch (err) {
            console.error(`Failed to fetch mapas for client ${clientId}:`, err);
            return [];
          }
        });

        const mapasPerClient = await Promise.all(mapaPromises);
        const allClientMapas = mapasPerClient.flat();
        setClientMapas(allClientMapas);
      } catch (error) {
        console.error('Failed to fetch client mapas:', error);
      }
    }
    fetchClientMapas();
  }, [clientIdsKey, mapasVersion]);

  // Get current case ID based on selection
  // For quick access filters (recent, favorites, myUploads), keep using the last selected case
  const currentCaseId = useMemo(() => {
    if (sidebarSelection.type === 'case') return sidebarSelection.caseId;
    if (sidebarSelection.type === 'mapa') {
      // When viewing a mapa, use its parent case ID
      const mapa = allMapas.find((m) => m.id === sidebarSelection.mapaId);
      return mapa?.caseId ?? null;
    }
    if (
      sidebarSelection.type === 'recent' ||
      sidebarSelection.type === 'favorites' ||
      sidebarSelection.type === 'myUploads'
    ) {
      // Use the stored selectedCaseId for quick access filters
      return selectedCaseId;
    }
    return null;
  }, [sidebarSelection, selectedCaseId, allMapas]);

  // Get effective client ID for fetching documents (for client inbox or client-level mapa)
  const effectiveClientIdForDocuments = useMemo(() => {
    // Direct client inbox selection takes priority
    if (selectedClientIdForInbox) return selectedClientIdForInbox;
    // When viewing a client-level mapa, use the mapa's client ID
    if (sidebarSelection.type === 'mapa') {
      // Check both case-level and client-level mapas
      const mapa =
        allMapas.find((m) => m.id === sidebarSelection.mapaId) ??
        clientMapas.find((m) => m.id === sidebarSelection.mapaId);
      if (mapa?.clientId) return mapa.clientId;
    }
    return null;
  }, [sidebarSelection, selectedClientIdForInbox, allMapas, clientMapas]);

  // Fetch documents for selected case
  const { documents: apiDocuments, refetch: refetchDocuments } = useCaseDocuments(currentCaseId);

  // Fetch client inbox documents when a client is selected or viewing client-level mapa
  const { documents: clientInboxApiDocuments, refetch: refetchClientInboxDocuments } =
    useClientInboxDocuments(effectiveClientIdForDocuments);

  // Transform API cases to CaseWithMape format for sidebar
  const cases = useMemo<CaseWithMape[]>(() => {
    return apiCases.map((c) => ({
      id: c.id,
      name: c.title,
      caseNumber: c.caseNumber,
      status: (c.status as 'Active' | 'PendingApproval' | 'OnHold' | 'Closed') || 'Active',
      documentCount: documentCountMap.get(c.id) ?? 0,
      mape: allMapas.filter((m) => m.caseId === c.id),
      unassignedDocumentCount: 0,
      clientId: c.client?.id,
      client: c.client,
    }));
  }, [apiCases, allMapas, documentCountMap]);

  // Modal state
  const [createMapaModalOpen, setCreateMapaModalOpen] = useState(false);
  const [createMapaCaseId, setCreateMapaCaseId] = useState<string | null>(null);
  const [createMapaClientId, setCreateMapaClientId] = useState<string | null>(null);
  const [slotAssignModalOpen, setSlotAssignModalOpen] = useState(false);
  const [selectedSlotForAssign, setSelectedSlotForAssign] = useState<MapaSlot | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedSlotForRequest, setSelectedSlotForRequest] = useState<MapaSlot | null>(null);
  const [addSlotModalOpen, setAddSlotModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [createDocumentModalOpen, setCreateDocumentModalOpen] = useState(false);

  // Document action modals
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [assignToMapaModalOpen, setAssignToMapaModalOpen] = useState(false);
  const [selectedDocumentForAction, setSelectedDocumentForAction] = useState<Document | null>(null);

  // Hooks
  const { cancelRequest } = useCancelDocumentRequest();
  const { openInWord, fetchDownloadUrl } = useDocumentPreview();
  const { data: userPreferences } = useUserPreferences();

  // Mark document as ready for review mutation
  const [markDocumentReadyForReview] = useMutation(MARK_DOCUMENT_READY_FOR_REVIEW, {
    onCompleted: () => {
      // Refetch documents to update the UI
      refetchDocuments();
    },
    onError: (err) => {
      console.error('[Documents] Failed to mark document ready for review:', err);
    },
  });

  // Mark document as final mutation
  const [markDocumentFinal] = useMutation(MARK_DOCUMENT_FINAL, {
    onCompleted: () => {
      // Refetch documents to update the UI
      refetchDocuments();
    },
    onError: (err) => {
      console.error('[Documents] Failed to mark document as final:', err);
    },
  });

  // Transform API documents to UI format
  const transformedDocs = useMemo(() => {
    if (!currentCaseId || !apiDocuments.length) return [];
    return apiDocuments.map((doc) => transformDocument(doc, currentCaseId));
  }, [apiDocuments, currentCaseId]);

  // Transform client inbox documents to UI format
  const transformedClientInboxDocs = useMemo(() => {
    if (!effectiveClientIdForDocuments || !clientInboxApiDocuments.length) return [];
    // Use a placeholder caseId since these docs aren't assigned to a case yet
    return clientInboxApiDocuments.map((doc) => transformDocument(doc, '__client_inbox__'));
  }, [clientInboxApiDocuments, effectiveClientIdForDocuments]);

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
      case 'recent':
        // Recent documents - sorted by upload date (newest first), limited to 20
        docs = [...transformedDocs]
          .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
          .slice(0, 20);
        crumbs = [{ label: 'Recente' }];
        break;
      case 'favorites':
        // Favorites - filter by isFavorite flag (when implemented)
        // For now, show empty state
        docs = transformedDocs.filter((d) => (d as unknown as { isFavorite?: boolean }).isFavorite);
        crumbs = [{ label: 'Favorite' }];
        break;
      case 'myUploads':
        // My uploads - filter by current user
        docs = user?.id ? transformedDocs.filter((d) => d.uploadedBy.id === user.id) : [];
        crumbs = [{ label: 'Încărcările mele' }];
        break;
      case 'clientInbox': {
        // Client inbox documents - documents not assigned to any case yet
        docs = transformedClientInboxDocs;
        const clientInfo = clientsWithDocuments.find((c) => c.id === sidebarSelection.clientId);
        crumbs = [
          { label: 'Documente', onClick: () => setSidebarSelection({ type: 'all' }) },
          { label: clientInfo?.name || 'Client' },
          { label: 'Inbox' },
        ];
        break;
      }
      default:
        docs = [];
        crumbs = [{ label: 'All Documents' }];
    }

    return { documents: docs, breadcrumb: crumbs };
  }, [
    sidebarSelection,
    setSidebarSelection,
    transformedDocs,
    transformedClientInboxDocs,
    cases,
    clientsWithDocuments,
    user?.id,
  ]);

  // Get review count - documents pending review from other team members
  // Only supervisors see the review queue
  const isSupervisor = isAssociateOrAbove(user?.dbRole);
  const reviewCount = useMemo(() => {
    if (!isSupervisor) return 0;
    return transformedDocs.filter(
      (d) =>
        d.uploadedBy?.id !== user?.id &&
        d.sourceType !== 'EMAIL_ATTACHMENT' &&
        (d.status === 'DRAFT' || d.status === 'READY_FOR_REVIEW')
    ).length;
  }, [transformedDocs, isSupervisor, user?.id]);

  // Check if we're viewing a mapa detail
  const viewingMapa = useMemo(() => {
    if (sidebarSelection.type !== 'mapa') return null;
    // Find mapa in case-level mapas first, then client-level mapas
    return (
      allMapas.find((m) => m.id === sidebarSelection.mapaId) ??
      clientMapas.find((m) => m.id === sidebarSelection.mapaId) ??
      null
    );
  }, [sidebarSelection, allMapas, clientMapas]);
  const viewingMapaCase = viewingMapa?.caseId
    ? cases.find((c) => c.id === viewingMapa.caseId)
    : null;
  const viewingMapaClient = viewingMapa?.clientId
    ? (clientsWithDocuments.find((c) => c.id === viewingMapa.clientId) ??
      apiCases.find((c) => c.client?.id === viewingMapa.clientId)?.client)
    : null;

  // Get client ID for fetching documents when viewing a client-level mapa
  const viewingMapaClientId = viewingMapa?.clientId ?? null;

  // Documents available for slot assignment based on mapa type
  const documentsForSlotAssign = useMemo(() => {
    if (!viewingMapa) return [];
    // For case-level mapas, use case documents
    if (viewingMapa.caseId) return transformedDocs;
    // For client-level mapas, use client inbox documents
    if (viewingMapa.clientId) return transformedClientInboxDocs;
    return [];
  }, [viewingMapa, transformedDocs, transformedClientInboxDocs]);

  // Handlers
  const handleUpload = () => {
    // Support both case-level and client inbox uploads
    if (!currentCaseId && !selectedClientIdForInbox) {
      console.warn('No case or client selected for upload');
      return;
    }
    setUploadModalOpen(true);
  };

  const handleCreateDocument = () => {
    // Support both case-level and client inbox document creation
    if (!currentCaseId && !selectedClientIdForInbox) {
      console.warn('No case or client selected for creating document');
      return;
    }
    setCreateDocumentModalOpen(true);
  };

  const handlePreviewDocument = (doc: Document) => {
    setPreviewDocument(doc.id);
    console.log('Preview document:', doc.fileName);
    // TODO: Open preview modal
  };

  const handleOpenInWord = async (doc: Document) => {
    const result = await openInWord(doc.id);
    if (!result) return;

    console.log('[OpenInWord] userPreferences:', userPreferences);
    console.log('[OpenInWord] documentOpenMethod:', userPreferences?.documentOpenMethod);
    const preferDesktop = userPreferences?.documentOpenMethod === 'DESKTOP';
    console.log('[OpenInWord] preferDesktop:', preferDesktop);

    if (preferDesktop) {
      // Prefer Word Desktop, fall back to Word Online
      if (result.wordUrl) {
        const link = document.createElement('a');
        link.href = result.wordUrl;
        link.click();
      } else if (result.webUrl) {
        window.open(result.webUrl, '_blank');
      }
    } else {
      // Prefer Word Online, fall back to Word Desktop
      if (result.webUrl) {
        window.open(result.webUrl, '_blank');
      } else if (result.wordUrl) {
        const link = document.createElement('a');
        link.href = result.wordUrl;
        link.click();
      }
    }
  };

  const handleDownloadDocument = async (doc: Document) => {
    const url = await fetchDownloadUrl(doc.id);
    if (url) {
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleRenameDocument = (doc: Document) => {
    setSelectedDocumentForAction(doc);
    setRenameModalOpen(true);
  };

  const handleDeleteDocument = (doc: Document) => {
    setSelectedDocumentForAction(doc);
    setDeleteModalOpen(true);
  };

  const handleAssignToMapa = (doc: Document) => {
    // Allow assignment from either case view or client inbox
    if (!currentCaseId && !selectedClientIdForInbox) {
      console.warn('No case or client selected for assign to mapa');
      return;
    }
    setSelectedDocumentForAction(doc);
    setAssignToMapaModalOpen(true);
  };

  const handleMarkReadyForReview = async (doc: Document) => {
    try {
      await markDocumentReadyForReview({ variables: { documentId: doc.id } });
    } catch (err) {
      // Error is handled by the mutation's onError callback
    }
  };

  const handleMarkFinal = async (doc: Document) => {
    try {
      await markDocumentFinal({ variables: { documentId: doc.id } });
    } catch (err) {
      // Error is handled by the mutation's onError callback
    }
  };

  // Get the client's cases with mapas for client inbox mode
  const clientCasesWithMapas = useMemo(() => {
    if (!selectedClientIdForInbox) return [];
    return cases.filter((c) => c.clientId === selectedClientIdForInbox && c.mape.length > 0);
  }, [selectedClientIdForInbox, cases]);

  const handleCreateMapa = (caseId: string) => {
    setCreateMapaCaseId(caseId);
    setCreateMapaClientId(null);
    setCreateMapaModalOpen(true);
  };

  const handleCreateClientMapa = (clientId: string) => {
    setCreateMapaClientId(clientId);
    setCreateMapaCaseId(null);
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
    // Refresh mapas list to show the updated slot
    setMapasVersion((v) => v + 1);
  };

  const handleMapaUpdated = (mapa: Mapa) => {
    console.log('Mapa updated:', mapa);
    // Refresh mapas list to show the updated mapa
    setMapasVersion((v) => v + 1);
  };

  const handleMapaDeleted = () => {
    console.log('Mapa deleted');
    // Refresh mapas list to remove the deleted one
    setMapasVersion((v) => v + 1);
    // Navigate back to the case or client
    if (viewingMapa) {
      if (viewingMapa.caseId) {
        setSidebarSelection({ type: 'case', caseId: viewingMapa.caseId });
      } else if (viewingMapa.clientId) {
        setSidebarSelection({ type: 'clientInbox', clientId: viewingMapa.clientId });
      }
    }
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
      <DocumentsSidebar
        cases={cases}
        clientMapas={clientMapas}
        onCreateMapa={handleCreateMapa}
        onCreateClientMapa={handleCreateClientMapa}
        clientsWithDocuments={clientsWithDocuments}
        selectedClientId={selectedClientIdForInbox}
        onSelectClientInbox={(clientId) => setSidebarSelection({ type: 'clientInbox', clientId })}
      />

      {/* Main Content */}
      {viewingMapa && (viewingMapaCase || viewingMapaClient) ? (
        <MapaDetail
          mapa={viewingMapa}
          caseName={viewingMapaCase?.name ?? viewingMapaClient?.name ?? 'Client'}
          onBack={() =>
            viewingMapaCase
              ? setSidebarSelection({ type: 'case', caseId: viewingMapaCase.id })
              : viewingMapaClient
                ? setSidebarSelection({ type: 'clientInbox', clientId: viewingMapaClient.id })
                : setSidebarSelection({ type: 'all' })
          }
          onAddSlot={() => setAddSlotModalOpen(true)}
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
          onCreateDocument={handleCreateDocument}
          onPreviewDocument={handlePreviewDocument}
          onOpenInWord={handleOpenInWord}
          onDownloadDocument={handleDownloadDocument}
          onRenameDocument={handleRenameDocument}
          onDeleteDocument={handleDeleteDocument}
          onAssignToMapa={handleAssignToMapa}
          onPrivacyChange={refetchDocuments}
          onMarkReadyForReview={handleMarkReadyForReview}
          onMarkFinal={handleMarkFinal}
        />
      )}

      {/* Create Mapa Modal */}
      {(createMapaCaseId || createMapaClientId) && (
        <CreateMapaModal
          open={createMapaModalOpen}
          onOpenChange={setCreateMapaModalOpen}
          caseId={createMapaCaseId ?? undefined}
          clientId={createMapaClientId ?? undefined}
          onSuccess={handleMapaCreated}
        />
      )}

      {/* Slot Assign Modal */}
      {selectedSlotForAssign && viewingMapa && (
        <SlotAssignModal
          open={slotAssignModalOpen}
          onOpenChange={setSlotAssignModalOpen}
          slot={selectedSlotForAssign}
          documents={documentsForSlotAssign}
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

      {/* Add Slot Modal */}
      {viewingMapa && (
        <AddSlotModal
          open={addSlotModalOpen}
          onOpenChange={setAddSlotModalOpen}
          mapaId={viewingMapa.id}
          onSuccess={() => {
            setMapasVersion((v) => v + 1);
          }}
        />
      )}

      {/* Upload Document Modal - supports case and client inbox uploads */}
      {(currentCaseId || selectedClientIdForInbox) && (
        <UploadDocumentModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          caseId={currentCaseId || undefined}
          clientId={!currentCaseId ? selectedClientIdForInbox || undefined : undefined}
          onSuccess={() => {
            // Documents will be refetched automatically via refetchQueries
            if (selectedClientIdForInbox) {
              refetchClientInboxDocuments();
            }
          }}
        />
      )}

      {/* Create Document Modal - supports both case-level and client inbox */}
      {(currentCaseId || selectedClientIdForInbox) && (
        <CreateDocumentModal
          open={createDocumentModalOpen}
          onOpenChange={setCreateDocumentModalOpen}
          caseId={currentCaseId || undefined}
          clientId={!currentCaseId ? selectedClientIdForInbox || undefined : undefined}
          onSuccess={() => {
            // Documents will be refetched automatically via refetchQueries
            if (selectedClientIdForInbox && !currentCaseId) {
              refetchClientInboxDocuments();
            }
          }}
        />
      )}

      {/* Rename Document Modal */}
      {selectedDocumentForAction && (
        <RenameDocumentModal
          open={renameModalOpen}
          onOpenChange={(open) => {
            setRenameModalOpen(open);
            if (!open) setSelectedDocumentForAction(null);
          }}
          documentId={selectedDocumentForAction.id}
          currentName={selectedDocumentForAction.fileName}
          onSuccess={() => {
            setSelectedDocumentForAction(null);
            refetchDocuments();
          }}
        />
      )}

      {/* Delete Document Modal */}
      {selectedDocumentForAction && (
        <DeleteDocumentModal
          open={deleteModalOpen}
          onOpenChange={(open) => {
            setDeleteModalOpen(open);
            if (!open) setSelectedDocumentForAction(null);
          }}
          documentId={selectedDocumentForAction.id}
          documentName={selectedDocumentForAction.fileName}
          onSuccess={() => {
            setSelectedDocumentForAction(null);
            refetchDocuments();
          }}
        />
      )}

      {/* Assign to Mapa Modal - supports both case-level and client inbox */}
      {selectedDocumentForAction && (currentCaseId || selectedClientIdForInbox) && (
        <AssignToMapaModal
          open={assignToMapaModalOpen}
          onOpenChange={(open) => {
            setAssignToMapaModalOpen(open);
            if (!open) setSelectedDocumentForAction(null);
          }}
          documentId={selectedDocumentForAction.caseDocumentId || selectedDocumentForAction.id}
          documentName={selectedDocumentForAction.fileName}
          caseId={currentCaseId || undefined}
          cases={selectedClientIdForInbox ? clientCasesWithMapas : undefined}
          onSuccess={() => {
            setSelectedDocumentForAction(null);
            setMapasVersion((v) => v + 1);
            if (selectedClientIdForInbox) {
              refetchClientInboxDocuments();
            } else {
              refetchDocuments();
            }
          }}
        />
      )}
    </div>
  );
}
