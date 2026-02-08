/**
 * Triage Panel
 *
 * Pre-classification panel for quick tagging of emails before sync.
 * Allows marking emails as important, urgent, or requiring follow-up.
 */

import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  TextField,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Icon,
  mergeStyleSets,
  ChoiceGroup,
  IChoiceGroupOption,
} from '@fluentui/react';
import { outlookApi, EmailInfo } from '../services/outlook-api';

// ============================================================================
// Styles
// ============================================================================

const styles = mergeStyleSets({
  container: {
    padding: '16px',
  },
  header: {
    marginBottom: '16px',
  },
  emailInfo: {
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    marginBottom: '16px',
  },
  emailSubject: {
    fontWeight: 600,
    fontSize: '14px',
    marginBottom: '4px',
  },
  emailFrom: {
    fontSize: '12px',
    color: '#666',
  },
  section: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tagGroup: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    marginBottom: '16px',
  },
  tag: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid #e0e0e0',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    selectors: {
      ':hover': {
        backgroundColor: '#f0f0f0',
      },
    },
  },
  tagSelected: {
    padding: '8px 16px',
    borderRadius: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 600,
  },
  urgentTag: {
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
    color: '#991b1b',
  },
  importantTag: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    color: '#92400e',
  },
  followUpTag: {
    backgroundColor: '#dbeafe',
    borderColor: '#bfdbfe',
    color: '#1e40af',
  },
  actionTag: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
    color: '#166534',
  },
  actions: {
    marginTop: '16px',
    display: 'flex',
    gap: '8px',
  },
  noEmail: {
    textAlign: 'center' as const,
    padding: '40px 16px',
  },
  noEmailIcon: {
    fontSize: '48px',
    color: '#ccc',
    marginBottom: '16px',
  },
});

// ============================================================================
// Types
// ============================================================================

type TriageTag = 'urgent' | 'important' | 'followUp' | 'actionRequired';
type Priority = 'high' | 'normal' | 'low';

interface TriageState {
  tags: TriageTag[];
  priority: Priority;
  notes: string;
  deadline?: Date;
}

const priorityOptions: IChoiceGroupOption[] = [
  { key: 'high', text: 'Ridicată', iconProps: { iconName: 'Important' } },
  { key: 'normal', text: 'Normală', iconProps: { iconName: 'Remove' } },
  { key: 'low', text: 'Scăzută', iconProps: { iconName: 'Down' } },
];

// ============================================================================
// Component
// ============================================================================

interface TriagePanelProps {
  onTriaged?: (state: TriageState) => void;
}

export function TriagePanel({ onTriaged }: TriagePanelProps) {
  const [emailInfo, setEmailInfo] = useState<EmailInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Triage state
  const [selectedTags, setSelectedTags] = useState<TriageTag[]>([]);
  const [priority, setPriority] = useState<Priority>('normal');
  const [notes, setNotes] = useState('');

  // Load email info on mount
  useEffect(() => {
    loadEmailData();
  }, []);

  const loadEmailData = async () => {
    setLoading(true);
    setError(null);

    try {
      const info = await outlookApi.getEmailInfo();
      setEmailInfo(info);
    } catch (err) {
      console.error('[TriagePanel] Failed to load email data:', err);
      setError('Nu s-au putut încărca datele email-ului.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tag: TriageTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const getTagClass = (tag: TriageTag, isSelected: boolean) => {
    if (!isSelected) return styles.tag;

    const baseClass = styles.tagSelected;
    switch (tag) {
      case 'urgent':
        return `${baseClass} ${styles.urgentTag}`;
      case 'important':
        return `${baseClass} ${styles.importantTag}`;
      case 'followUp':
        return `${baseClass} ${styles.followUpTag}`;
      case 'actionRequired':
        return `${baseClass} ${styles.actionTag}`;
      default:
        return baseClass;
    }
  };

  const handleSave = async () => {
    if (selectedTags.length === 0 && !notes) {
      setError('Selectați cel puțin o etichetă sau adăugați o notă.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const triageState: TriageState = {
        tags: selectedTags,
        priority,
        notes,
      };

      // In a real implementation, this would save to the backend
      // For now, we just notify the parent component
      onTriaged?.(triageState);
      setSuccess('Email clasificat cu succes!');

      // Reset form after save
      setTimeout(() => {
        setSelectedTags([]);
        setPriority('normal');
        setNotes('');
        setSuccess(null);
      }, 2000);
    } catch (err) {
      console.error('[TriagePanel] Failed to save triage:', err);
      setError('Nu s-a putut salva clasificarea.');
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Stack className={styles.container} horizontalAlign="center" verticalAlign="center">
        <Spinner size={SpinnerSize.large} label="Se încarcă..." />
      </Stack>
    );
  }

  // No email selected
  if (!emailInfo) {
    return (
      <Stack className={styles.noEmail}>
        <Icon iconName="Mail" className={styles.noEmailIcon} />
        <Text variant="large">Niciun email selectat</Text>
        <Text variant="small" style={{ marginTop: '8px', color: '#666' }}>
          Selectați un email în Outlook pentru a-l clasifica.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack className={styles.container}>
      {/* Header */}
      <Text variant="xLarge" className={styles.header}>
        Clasificare Rapidă
      </Text>

      {/* Email Info */}
      <div className={styles.emailInfo}>
        <div className={styles.emailSubject}>{emailInfo.subject || '(Fără subiect)'}</div>
        <div className={styles.emailFrom}>
          De la: {emailInfo.from?.displayName || emailInfo.from?.emailAddress || 'Necunoscut'}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          onDismiss={() => setError(null)}
          dismissButtonAriaLabel="Închide"
          style={{ marginBottom: '16px' }}
        >
          {error}
        </MessageBar>
      )}

      {success && (
        <MessageBar
          messageBarType={MessageBarType.success}
          onDismiss={() => setSuccess(null)}
          dismissButtonAriaLabel="Închide"
          style={{ marginBottom: '16px' }}
        >
          {success}
        </MessageBar>
      )}

      {/* Quick Tags */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Icon iconName="Tag" />
          Etichete Rapide
        </div>
        <div className={styles.tagGroup}>
          <div
            className={getTagClass('urgent', selectedTags.includes('urgent'))}
            onClick={() => toggleTag('urgent')}
          >
            <Icon iconName="AlertSolid" />
            Urgent
          </div>
          <div
            className={getTagClass('important', selectedTags.includes('important'))}
            onClick={() => toggleTag('important')}
          >
            <Icon iconName="FavoriteStar" />
            Important
          </div>
          <div
            className={getTagClass('followUp', selectedTags.includes('followUp'))}
            onClick={() => toggleTag('followUp')}
          >
            <Icon iconName="Ringer" />
            Urmărire
          </div>
          <div
            className={getTagClass('actionRequired', selectedTags.includes('actionRequired'))}
            onClick={() => toggleTag('actionRequired')}
          >
            <Icon iconName="ClipboardList" />
            Acțiune Necesară
          </div>
        </div>
      </div>

      {/* Priority */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Icon iconName="Sort" />
          Prioritate
        </div>
        <ChoiceGroup
          selectedKey={priority}
          options={priorityOptions}
          onChange={(_, option) => option && setPriority(option.key as Priority)}
          styles={{ flexContainer: { display: 'flex', gap: '16px' } }}
        />
      </div>

      {/* Notes */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Icon iconName="EditNote" />
          Note
        </div>
        <TextField
          placeholder="Adăugați note sau context..."
          value={notes}
          onChange={(_, value) => setNotes(value || '')}
          multiline
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <PrimaryButton
          text="Salvează Clasificare"
          onClick={handleSave}
          disabled={saving}
          iconProps={{ iconName: saving ? 'Sync' : 'Save' }}
        />
        <DefaultButton
          text="Resetează"
          onClick={() => {
            setSelectedTags([]);
            setPriority('normal');
            setNotes('');
          }}
          iconProps={{ iconName: 'Clear' }}
        />
      </div>
    </Stack>
  );
}
