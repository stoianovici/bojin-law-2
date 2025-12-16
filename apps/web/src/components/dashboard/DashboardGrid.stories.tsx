import type { Meta, StoryObj } from '@storybook/react';
import { DashboardGrid } from './DashboardGrid';

/**
 * DashboardGrid is the drag-and-drop container for dashboard widgets.
 * Supports 12-column layout with responsive breakpoints and localStorage persistence.
 */
const meta: Meta<typeof DashboardGrid> = {
  title: 'Dashboard/DashboardGrid',
  component: DashboardGrid,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof DashboardGrid>;

const mockLayout = [
  { i: 'widget-1', x: 0, y: 0, w: 6, h: 4 },
  { i: 'widget-2', x: 6, y: 0, w: 6, h: 4 },
  { i: 'widget-3', x: 0, y: 4, w: 4, h: 3 },
  { i: 'widget-4', x: 4, y: 4, w: 8, h: 3 },
];

export const EmptyGrid: Story = {
  args: {
    layout: [],
    onLayoutChange: () => {},
    children: (
      <div className="flex items-center justify-center h-96 bg-neutral-50 rounded-lg border-2 border-dashed border-neutral-300">
        <p className="text-neutral-500">Grid gol - adăugați widget-uri</p>
      </div>
    ),
  },
};

export const WithWidgets: Story = {
  args: {
    layout: mockLayout,
    onLayoutChange: (layout: typeof mockLayout) => console.log('Layout changed:', layout),
    children: mockLayout.map((item) => (
      <div key={item.i} className="bg-white border rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold mb-2">Widget {item.i}</h3>
        <p className="text-sm text-neutral-600">
          Position: ({item.x}, {item.y}), Size: {item.w}x{item.h}
        </p>
      </div>
    )),
  },
};

export const DragModeActive: Story = {
  args: {
    layout: mockLayout,
    onLayoutChange: (layout: typeof mockLayout) => console.log('Layout changed:', layout),
    children: mockLayout.map((item) => (
      <div
        key={item.i}
        className="bg-white border-2 border-dashed border-blue-400 rounded-lg p-4 shadow-lg cursor-move"
      >
        <h3 className="font-semibold mb-2">Widget {item.i}</h3>
        <p className="text-sm text-blue-600">Trageți pentru a repoziția</p>
      </div>
    )),
  },
};
