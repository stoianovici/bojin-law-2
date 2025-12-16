import type { Meta, StoryObj } from '@storybook/react';
import { CommandBar } from './CommandBar';
import { action } from '@storybook/addon-actions';
import React from 'react';

/**
 * CommandBar provides a natural language command interface for document operations.
 * Fixed at bottom of editor area with text input, voice button, and submit button.
 * Shows suggested commands when focused and displays result messages after execution.
 */
const meta: Meta<typeof CommandBar> = {
  title: 'Document/CommandBar',
  component: CommandBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullwidth',
  },
};

export default meta;
type Story = StoryObj<typeof CommandBar>;

type CommandBarArgs = {
  onCommandSubmit: (command: string) => void;
  isLoading: boolean;
  resultMessage?: string;
};

/**
 * Default state with empty input
 */
export const Default: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: false,
  },
  render: (args: { onCommandSubmit: (command: string) => void; isLoading: boolean }) => (
    <div className="h-[400px] relative bg-gray-50">
      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
        <p>Editor content area (command bar fixed at bottom)</p>
      </div>
      <CommandBar {...args} />
    </div>
  ),
};

/**
 * Command bar with input text
 */
export const WithInputText: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: false,
  },
  render: (args: CommandBarArgs) => {
    const [command, setCommand] = React.useState('Adaugă clauză de confidențialitate');
    return (
      <div className="h-[400px] relative bg-gray-50">
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <p>Editor content area</p>
        </div>
        <CommandBar {...args} />
      </div>
    );
  },
};

/**
 * Loading state with spinner animation
 */
export const Loading: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: true,
  },
  render: (args: CommandBarArgs) => (
    <div className="h-[400px] relative bg-gray-50">
      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
        <p>Processing command...</p>
      </div>
      <CommandBar {...args} />
    </div>
  ),
};

/**
 * Command bar with result message displayed
 */
export const WithResultMessage: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: false,
    resultMessage:
      'Clauza de confidențialitate a fost adăugată cu succes la documentul dumneavoastră.',
  },
  render: (args: CommandBarArgs) => (
    <div className="h-[400px] relative bg-gray-50">
      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
        <p>Command executed successfully!</p>
      </div>
      <CommandBar {...args} />
    </div>
  ),
};

/**
 * Suggested commands displayed when focused
 */
export const WithSuggestions: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: false,
  },
  render: (args: CommandBarArgs) => {
    const [isFocused, setIsFocused] = React.useState(true);
    return (
      <div className="h-[500px] relative bg-gray-50">
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <p>Click input to see suggested commands</p>
        </div>
        <CommandBar {...args} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Focus on the input field to see 4 suggested commands in Romanian',
      },
    },
  },
};

/**
 * Interactive command submission
 */
export const InteractiveSubmit: Story = {
  args: {
    onCommandSubmit: (command: string) => {
      action('command-submitted')(command);
      console.log('Command executed:', command);
      alert(`Comandă executată: "${command}"`);
    },
    isLoading: false,
  },
  render: (args: CommandBarArgs) => {
    const [isLoading, setIsLoading] = React.useState(false);
    const [resultMessage, setResultMessage] = React.useState('');

    const handleSubmit = (command: string) => {
      setIsLoading(true);
      args.onCommandSubmit?.(command);

      // Simulate command execution
      setTimeout(() => {
        setIsLoading(false);
        setResultMessage(`Comanda "${command}" a fost executată cu succes!`);

        // Auto-hide result after 5 seconds
        setTimeout(() => {
          setResultMessage('');
        }, 5000);
      }, 2000);
    };

    return (
      <div className="h-[400px] relative bg-gray-50">
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <p>Type a command and press Enter or click Send</p>
        </div>
        <CommandBar
          {...args}
          onCommandSubmit={handleSubmit}
          isLoading={isLoading}
          resultMessage={resultMessage}
        />
      </div>
    );
  },
};

/**
 * Voice input button interaction
 */
export const VoiceInputInteractive: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: false,
  },
  render: (args: CommandBarArgs) => (
    <div className="h-[400px] relative bg-gray-50">
      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
        <p>Click microphone button to test voice input</p>
      </div>
      <CommandBar {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Click the microphone button to trigger voice input (mock functionality)',
      },
    },
  },
};

/**
 * Keyboard shortcut demonstration (Ctrl+/)
 */
export const KeyboardShortcut: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: false,
  },
  render: (args: CommandBarArgs) => (
    <div className="h-[400px] relative bg-gray-50">
      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="mb-2">
            Press <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 rounded">Ctrl</kbd> +{' '}
            <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 rounded">/</kbd>
          </p>
          <p>to focus the command input</p>
        </div>
      </div>
      <CommandBar {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Press Ctrl+/ keyboard shortcut to focus the command input field',
      },
    },
  },
};

/**
 * Romanian suggested commands
 */
export const RomanianCommands: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: false,
  },
  render: (args: CommandBarArgs) => (
    <div className="h-[500px] relative bg-gray-50">
      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
        <p>Focus input to see Romanian command suggestions</p>
      </div>
      <CommandBar {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Suggested commands in Romanian: "Adaugă clauză de confidențialitate", "Verifică pentru erori", "Generează rezumat", "Traduce în engleză"',
      },
    },
  },
};

/**
 * Romanian diacritics in commands and messages
 * Verifies: ă, â, î, ș, ț characters display correctly
 */
export const RomanianDiacritics: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: false,
    resultMessage:
      'Modificările au fost aplicate cu succes. Documentul conține acum clauza de confidențialitate și obligațiile părților.',
  },
  render: (args: CommandBarArgs) => (
    <div className="h-[500px] relative bg-gray-50">
      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 p-8">
        <h3 className="text-lg font-semibold mb-4">Test Diacritice Românești</h3>
        <ul className="text-sm space-y-1 text-left">
          <li>✓ Placeholder: "Scrie o comandă..."</li>
          <li>✓ Sugestii: "Adaugă", "Verifică", "Generează"</li>
          <li>✓ Mesaj rezultat: "Modificările", "confidențialitate", "obligațiile", "părților"</li>
          <li>✓ Helper text: "Folosește", "să"</li>
        </ul>
      </div>
      <CommandBar {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Verify Romanian diacritics in all command bar text: placeholder, suggestions, result messages, helper text',
      },
    },
  },
};

/**
 * Long command input
 */
export const LongCommand: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: false,
  },
  render: (args: CommandBarArgs) => (
    <div className="h-[400px] relative bg-gray-50">
      <CommandBar {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Test with long command: "Adaugă o clauză detaliată privind confidențialitatea și protecția datelor cu caracter personal conform Regulamentului GDPR și legislației românești în vigoare"',
      },
    },
  },
};

/**
 * Disabled state during loading
 */
export const DisabledDuringLoading: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: true,
  },
  render: (args: CommandBarArgs) => (
    <div className="h-[400px] relative bg-gray-50">
      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
        <p>All buttons disabled during command execution</p>
      </div>
      <CommandBar {...args} />
    </div>
  ),
};

/**
 * Mobile responsive view
 */
export const MobileView: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  render: (args: CommandBarArgs) => (
    <div className="h-[400px] relative bg-gray-50">
      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
        <p>Mobile layout</p>
      </div>
      <CommandBar {...args} />
    </div>
  ),
};

/**
 * Tablet responsive view
 */
export const TabletView: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
  render: (args: CommandBarArgs) => (
    <div className="h-[400px] relative bg-gray-50">
      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
        <p>Tablet layout</p>
      </div>
      <CommandBar {...args} />
    </div>
  ),
};

/**
 * Multiple command executions sequence
 */
export const MultipleCommands: Story = {
  args: {
    onCommandSubmit: action('command-submitted'),
    isLoading: false,
  },
  render: (args: CommandBarArgs) => {
    const [commandHistory, setCommandHistory] = React.useState<string[]>([]);

    const handleSubmit = (command: string) => {
      setCommandHistory([...commandHistory, command]);
      args.onCommandSubmit?.(command);
    };

    return (
      <div className="h-[500px] relative bg-gray-50">
        <div className="absolute inset-0 flex flex-col items-center justify-start p-8 overflow-auto">
          <h3 className="text-lg font-semibold mb-4">Command History</h3>
          {commandHistory.length === 0 ? (
            <p className="text-gray-400">No commands executed yet</p>
          ) : (
            <ul className="w-full max-w-md space-y-2">
              {commandHistory.map((cmd, i) => (
                <li key={i} className="p-2 bg-white border border-gray-200 rounded text-sm">
                  {i + 1}. {cmd}
                </li>
              ))}
            </ul>
          )}
        </div>
        <CommandBar {...args} onCommandSubmit={handleSubmit} />
      </div>
    );
  },
};
