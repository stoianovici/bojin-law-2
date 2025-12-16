import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from '../atoms/Button';

const meta: Meta<typeof Modal> = {
  title: 'Components/Modal',
  component: Modal,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Modal>;

const DefaultStory = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Deschide Modalul</Button>
      <Modal open={open} onOpenChange={setOpen} title="Titlu Modal">
        <p>Acesta este conținutul modalului.</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => setOpen(false)}>Închide</Button>
        </div>
      </Modal>
    </>
  );
};

export const Default: Story = {
  render: () => <DefaultStory />,
};

const WithDescriptionStory = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Confirmă acțiunea</Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Confirmați acțiunea"
        description="Sunteți sigur că doriți să continuați? Această acțiune nu poate fi anulată."
      >
        <div className="flex gap-2 mt-4">
          <Button onClick={() => setOpen(false)}>Confirmă</Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Anulează
          </Button>
        </div>
      </Modal>
    </>
  );
};

export const WithDescription: Story = {
  render: () => <WithDescriptionStory />,
};

const AllSizesStory = () => {
  const [size, setSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            setSize('sm');
            setOpen(true);
          }}
        >
          Small
        </Button>
        <Button
          onClick={() => {
            setSize('md');
            setOpen(true);
          }}
        >
          Medium
        </Button>
        <Button
          onClick={() => {
            setSize('lg');
            setOpen(true);
          }}
        >
          Large
        </Button>
        <Button
          onClick={() => {
            setSize('xl');
            setOpen(true);
          }}
        >
          Extra Large
        </Button>
      </div>
      <Modal open={open} onOpenChange={setOpen} title={`Modal ${size.toUpperCase()}`} size={size}>
        <p>Acesta este un modal de mărime {size}.</p>
        <Button className="mt-4" onClick={() => setOpen(false)}>
          Închide
        </Button>
      </Modal>
    </>
  );
};

export const AllSizes: Story = {
  render: () => <AllSizesStory />,
};
