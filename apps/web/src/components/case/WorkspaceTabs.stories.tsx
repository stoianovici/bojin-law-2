/**
 * WorkspaceTabs Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { WorkspaceTabs, TabContent } from './WorkspaceTabs';

const meta: Meta<typeof WorkspaceTabs> = {
  title: 'Case/WorkspaceTabs',
  component: WorkspaceTabs,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof WorkspaceTabs>;

/**
 * Default workspace tabs with all tab content
 */
export const Default: Story = {
  render: () => (
    <WorkspaceTabs>
      <TabContent value="overview">
        <div className="p-6 bg-gray-50 h-96">
          <h2 className="text-2xl font-bold mb-4">Prezentare Generală</h2>
          <p className="text-gray-700">
            Aici va fi afișată prezentarea generală a cazului cu detalii, echipa, activitate recentă
            și termene cheie.
          </p>
        </div>
      </TabContent>
      <TabContent value="documents">
        <div className="p-6 bg-gray-50 h-96">
          <h2 className="text-2xl font-bold mb-4">Documente</h2>
          <p className="text-gray-700">
            Aici va fi afișat arborele de foldere, lista de documente și panoul de previzualizare.
          </p>
        </div>
      </TabContent>
      <TabContent value="tasks">
        <div className="p-6 bg-gray-50 h-96">
          <h2 className="text-2xl font-bold mb-4">Sarcini</h2>
          <p className="text-gray-700">
            Aici va fi afișat panoul kanban cu sarcinile organizate pe coloane.
          </p>
        </div>
      </TabContent>
      <TabContent value="communications">
        <div className="p-6 bg-gray-50 h-96">
          <h2 className="text-2xl font-bold mb-4">Comunicări</h2>
          <p className="text-gray-700">
            Aici vor fi afișate firele de email și mesajele legate de caz.
          </p>
        </div>
      </TabContent>
      <TabContent value="time-entries">
        <div className="p-6 bg-gray-50 h-96">
          <h2 className="text-2xl font-bold mb-4">Înregistrări Timp</h2>
          <p className="text-gray-700">
            Aici vor fi afișate înregistrările de timp facturabil pentru acest caz.
          </p>
        </div>
      </TabContent>
      <TabContent value="notes">
        <div className="p-6 bg-gray-50 h-96">
          <h2 className="text-2xl font-bold mb-4">Notițe</h2>
          <p className="text-gray-700">Aici vor fi afișate notițele și adnotările legate de caz.</p>
        </div>
      </TabContent>
    </WorkspaceTabs>
  ),
};

/**
 * Tabs only without content for layout demonstration
 */
export const TabsOnly: Story = {
  render: () => <WorkspaceTabs />,
};

/**
 * Overview tab active
 */
export const OverviewActive: Story = {
  render: () => (
    <WorkspaceTabs>
      <TabContent value="overview">
        <div className="p-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Detalii Caz</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-700 mb-2">Informații Generale</h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-gray-600">Deschis la:</dt>
                    <dd className="font-medium">15 Ianuarie 2024</dd>
                  </div>
                  <div>
                    <dt className="text-gray-600">Valoare:</dt>
                    <dd className="font-medium">€50,000</dd>
                  </div>
                </dl>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-700 mb-2">Echipă</h3>
                <ul className="space-y-2 text-sm">
                  <li>Ion Popescu - Partner</li>
                  <li>Maria Ionescu - Asociat</li>
                  <li>Andrei Popa - Asociat</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </TabContent>
      <TabContent value="documents">
        <div className="p-6">Documents content</div>
      </TabContent>
      <TabContent value="tasks">
        <div className="p-6">Tasks content</div>
      </TabContent>
      <TabContent value="communications">
        <div className="p-6">Communications content</div>
      </TabContent>
      <TabContent value="time-entries">
        <div className="p-6">Time entries content</div>
      </TabContent>
      <TabContent value="notes">
        <div className="p-6">Notes content</div>
      </TabContent>
    </WorkspaceTabs>
  ),
};

/**
 * Mobile responsive view (narrow viewport)
 */
export const MobileView: Story = {
  render: () => (
    <div className="max-w-sm">
      <WorkspaceTabs>
        <TabContent value="overview">
          <div className="p-4 bg-gray-50">
            <h2 className="text-lg font-bold mb-2">Prezentare Generală</h2>
            <p className="text-sm text-gray-700">Conținut optimizat pentru mobil</p>
          </div>
        </TabContent>
        <TabContent value="documents">
          <div className="p-4 bg-gray-50">Documente</div>
        </TabContent>
        <TabContent value="tasks">
          <div className="p-4 bg-gray-50">Sarcini</div>
        </TabContent>
        <TabContent value="communications">
          <div className="p-4 bg-gray-50">Comunicări</div>
        </TabContent>
        <TabContent value="time-entries">
          <div className="p-4 bg-gray-50">Înregistrări Timp</div>
        </TabContent>
        <TabContent value="notes">
          <div className="p-4 bg-gray-50">Notițe</div>
        </TabContent>
      </WorkspaceTabs>
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

/**
 * With Romanian diacritics in content
 */
export const RomanianContent: Story = {
  render: () => (
    <WorkspaceTabs>
      <TabContent value="overview">
        <div className="p-6 bg-white">
          <h2 className="text-2xl font-bold mb-4">Prezentare Generală - Caracteree Speciale</h2>
          <p className="text-gray-700">
            Această pagină demonstrează suportul pentru caracterele românești: ă, â, î, ș, ț.
          </p>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium mb-2">Caz: Divorț - București</h3>
            <p className="text-sm text-gray-700">
              Proces de divorț cu împărțirea averii și stabilirea custodiei copilului. Client:
              Popescu-Ionescu Maria-Ioana.
            </p>
          </div>
        </div>
      </TabContent>
      <TabContent value="documents">
        <div className="p-6">Documente</div>
      </TabContent>
      <TabContent value="tasks">
        <div className="p-6">Sarcini</div>
      </TabContent>
      <TabContent value="communications">
        <div className="p-6">Comunicări</div>
      </TabContent>
      <TabContent value="time-entries">
        <div className="p-6">Înregistrări Timp</div>
      </TabContent>
      <TabContent value="notes">
        <div className="p-6">Notițe</div>
      </TabContent>
    </WorkspaceTabs>
  ),
};

/**
 * Keyboard navigation demonstration
 */
export const KeyboardNavigation: Story = {
  render: () => (
    <div>
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Navigare cu tastatura:</strong>
          <br />
          • Tab: Navighează între taburi
          <br />
          • Săgeți stânga/dreapta: Comută între taburi
          <br />
          • Enter/Space: Activează tabul selectat
          <br />• Focus visible pentru accesibilitate
        </p>
      </div>
      <WorkspaceTabs>
        <TabContent value="overview">
          <div className="p-6 bg-gray-50 h-64">Conținut Prezentare Generală</div>
        </TabContent>
        <TabContent value="documents">
          <div className="p-6 bg-gray-50 h-64">Conținut Documente</div>
        </TabContent>
        <TabContent value="tasks">
          <div className="p-6 bg-gray-50 h-64">Conținut Sarcini</div>
        </TabContent>
        <TabContent value="communications">
          <div className="p-6 bg-gray-50 h-64">Conținut Comunicări</div>
        </TabContent>
        <TabContent value="time-entries">
          <div className="p-6 bg-gray-50 h-64">Conținut Înregistrări Timp</div>
        </TabContent>
        <TabContent value="notes">
          <div className="p-6 bg-gray-50 h-64">Conținut Notițe</div>
        </TabContent>
      </WorkspaceTabs>
    </div>
  ),
};
