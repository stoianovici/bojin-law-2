import type { Meta, StoryObj } from '@storybook/react';
import { VersionComparison } from './VersionComparison';
import { action } from '@storybook/addon-actions';

/**
 * VersionComparison displays side-by-side diff view for document versions.
 * Shows previous and current versions with highlighted changes (green=added, red=removed).
 * Includes semantic change indicators and synchronized scrolling between panels.
 */
const meta: Meta<typeof VersionComparison> = {
  title: 'Document/VersionComparison',
  component: VersionComparison,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullwidth',
  },
};

export default meta;
type Story = StoryObj<typeof VersionComparison>;

/**
 * Default state showing version comparison with mock data
 */
export const Default: Story = {
  args: {
    onAcceptChanges: action('accept-changes'),
    onRejectChanges: action('reject-changes'),
  },
};

/**
 * Comparison with custom version info
 */
export const CustomVersions: Story = {
  args: {
    previousVersion: {
      info: {
        versionNumber: 3,
        date: '2024-11-01 10:00',
        author: 'Ana Ionescu',
      },
      content: `CONTRACT DE PRESTĂRI SERVICII\n\nVersiunea anterioară a contractului.\n\nARTICOLUL 1 - OBIECTUL\n\n1.1. Servicii de consultanță.`,
    },
    currentVersion: {
      info: {
        versionNumber: 4,
        date: '2024-11-13 15:30',
        author: 'Mihai Bojin',
      },
      content: `CONTRACT DE PRESTĂRI SERVICII JURIDICE\n\nVersiunea curentă actualizată.\n\nARTICOLUL 1 - OBIECTUL CONTRACTULUI\n\n1.1. Servicii de consultanță juridică și reprezentare.`,
    },
    semanticChanges: [
      {
        type: 'modified',
        lineNumber: 1,
        description: 'Titlu extins: "JURIDICE" adăugat',
      },
      {
        type: 'added',
        lineNumber: 5,
        description: 'Detalii suplimentare: "reprezentare" adăugat',
      },
    ],
    onAcceptChanges: action('accept-changes'),
    onRejectChanges: action('reject-changes'),
  },
};

/**
 * Comparison with many semantic changes
 */
export const ManyChanges: Story = {
  args: {
    onAcceptChanges: action('accept-changes'),
    onRejectChanges: action('reject-changes'),
  },
};

/**
 * Comparison showing clause additions (green highlights)
 */
export const ClauseAdditions: Story = {
  args: {
    previousVersion: {
      info: {
        versionNumber: 1,
        date: '2024-11-10 14:30',
        author: 'Mihai Bojin',
      },
      content: `CONTRACT DE PRESTĂRI SERVICII\n\nARTICOLUL 1 - OBIECTUL CONTRACTULUI\n\n1.1. Prestator furnizează servicii.`,
    },
    currentVersion: {
      info: {
        versionNumber: 2,
        date: '2024-11-15 16:45',
        author: 'Mihai Bojin',
      },
      content: `CONTRACT DE PRESTĂRI SERVICII\n\nARTICOLUL 1 - OBIECTUL CONTRACTULUI\n\n1.1. Prestator furnizează servicii.\n\nARTICOLUL 2 - CONFIDENȚIALITATE\n\n2.1. Părțile se obligă să păstreze confidențialitatea.`,
    },
    semanticChanges: [
      {
        type: 'added',
        lineNumber: 7,
        description: 'Adăugat articol nou: CONFIDENȚIALITATE',
      },
    ],
    onAcceptChanges: action('accept-changes'),
    onRejectChanges: action('reject-changes'),
  },
};

/**
 * Comparison showing clause removals (red highlights)
 */
export const ClauseRemovals: Story = {
  args: {
    previousVersion: {
      info: {
        versionNumber: 1,
        date: '2024-11-10 14:30',
        author: 'Mihai Bojin',
      },
      content: `CONTRACT DE PRESTĂRI SERVICII\n\nARTICOLUL 1 - OBIECTUL\n\n1.1. Servicii.\n\nARTICOLUL 2 - TAXE SPECIALE\n\n2.1. Taxe de 1000 EUR.`,
    },
    currentVersion: {
      info: {
        versionNumber: 2,
        date: '2024-11-15 16:45',
        author: 'Mihai Bojin',
      },
      content: `CONTRACT DE PRESTĂRI SERVICII\n\nARTICOLUL 1 - OBIECTUL\n\n1.1. Servicii.`,
    },
    semanticChanges: [
      {
        type: 'removed',
        lineNumber: 7,
        description: 'Eliminat articol: TAXE SPECIALE',
      },
    ],
    onAcceptChanges: action('accept-changes'),
    onRejectChanges: action('reject-changes'),
  },
};

/**
 * Comparison showing term modifications (blue highlights)
 */
export const TermModifications: Story = {
  args: {
    onAcceptChanges: action('accept-changes'),
    onRejectChanges: action('reject-changes'),
  },
};

/**
 * Interactive accept/reject buttons
 */
export const InteractiveButtons: Story = {
  args: {
    onAcceptChanges: () => {
      action('accept-changes')();
      alert('Modificările au fost acceptate!');
    },
    onRejectChanges: () => {
      action('reject-changes')();
      alert('Modificările au fost respinse!');
    },
  },
};

/**
 * Navigation through semantic changes
 */
export const ChangeNavigation: Story = {
  args: {
    onAcceptChanges: action('accept-changes'),
    onRejectChanges: action('reject-changes'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Use Previous/Next buttons to navigate through 8 semantic changes',
      },
    },
  },
};

/**
 * Romanian diacritics in version content
 * Verifies: ă, â, î, ș, ț characters display correctly in diff view
 */
export const RomanianDiacritics: Story = {
  args: {
    previousVersion: {
      info: {
        versionNumber: 1,
        date: '2024-11-10 14:30',
        author: 'Mihai Bojin',
      },
      content: `CONTRACT - Versiune Veche

Caracterele românești vechi:
- părți contractante
- încredere și bună-credință
- servicii de consultanță
- obligații contractuale`,
    },
    currentVersion: {
      info: {
        versionNumber: 2,
        date: '2024-11-15 16:45',
        author: 'Mihai Bojin',
      },
      content: `CONTRACT - Versiune Nouă

Caracterele românești noi:
- părți contractante
- încredere și bună-credință
- servicii de consultanță juridică și fiscală
- obligații contractuale și răspunderi`,
    },
    semanticChanges: [
      {
        type: 'modified',
        lineNumber: 6,
        description: 'Extins: adăugat "juridică și fiscală"',
      },
      {
        type: 'modified',
        lineNumber: 7,
        description: 'Extins: adăugat "și răspunderi"',
      },
    ],
    onAcceptChanges: action('accept-changes'),
    onRejectChanges: action('reject-changes'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Verify Romanian diacritics render correctly in both version panels: părți, încredere, servicii, obligații',
      },
    },
  },
};

/**
 * Synchronized scroll demonstration
 */
export const SynchronizedScroll: Story = {
  args: {
    onAcceptChanges: action('accept-changes'),
    onRejectChanges: action('reject-changes'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Scroll either panel and watch the other panel scroll in sync',
      },
    },
  },
};

/**
 * Mobile responsive view
 */
export const MobileView: Story = {
  args: {
    onAcceptChanges: action('accept-changes'),
    onRejectChanges: action('reject-changes'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'On mobile, version panels stack vertically',
      },
    },
  },
};

/**
 * Tablet responsive view
 */
export const TabletView: Story = {
  args: {
    onAcceptChanges: action('accept-changes'),
    onRejectChanges: action('reject-changes'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

/**
 * Full height comparison
 */
export const FullHeight: Story = {
  args: {
    onAcceptChanges: action('accept-changes'),
    onRejectChanges: action('reject-changes'),
  },
  render: (args) => (
    <div className="h-[900px]">
      <VersionComparison {...args} />
    </div>
  ),
};
