'use client';

// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { FilterBar } from '../../components/communication/FilterBar';
import { ThreadList } from '../../components/communication/ThreadList';
import { MessageView } from '../../components/communication/MessageView';
import { AIDraftResponsePanel } from '../../components/communication/AIDraftResponsePanel';
import { ExtractedItemsSidebar } from '../../components/communication/ExtractedItemsSidebar';
import { ComposeInterface } from '../../components/communication/ComposeInterface';
import { useCommunicationStore } from '../../stores/communication.store';
import { Plus } from 'lucide-react';

export default function CommunicationsPage() {
  const { openCompose } = useCommunicationStore();

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* Page Header */}
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Comunicări</h1>
        <button
          onClick={() => openCompose('new')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Mesaj nou
        </button>
      </div>

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Thread List */}
        <div className="flex w-full flex-col border-r bg-white md:w-96 lg:w-1/4">
          <FilterBar />
          <ThreadList className="flex-1" />
        </div>

        {/* Center Column: Message View (hidden on mobile, shown on md+) */}
        <div className="hidden flex-1 flex-col md:flex">
          <MessageView />
          <AIDraftResponsePanel />
        </div>

        {/* Right Column: Extracted Items Sidebar (hidden on tablet, shown on lg+) */}
        <div className="hidden w-80 flex-col border-l bg-white lg:flex overflow-y-auto">
          <ExtractedItemsSidebar />
        </div>
      </div>

      {/* Compose Modal */}
      <ComposeInterface />
    </main>
  );
}
