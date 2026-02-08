/**
 * Thread Share Panel
 *
 * Panel for sharing email threads with colleagues.
 * Grants full access to conversation for collaboration.
 */

import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  SearchBox,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Icon,
  Persona,
  PersonaSize,
  mergeStyleSets,
  ChoiceGroup,
  IChoiceGroupOption,
} from '@fluentui/react';
import { outlookApi, EmailInfo } from '../services/outlook-api';
import { apiClient, TeamMember, ShareResult } from '../services/api-client';

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
  threadInfo: {
    fontSize: '12px',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
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
  memberList: {
    maxHeight: '250px',
    overflowY: 'auto' as const,
  },
  memberItem: {
    padding: '12px',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
    marginBottom: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    selectors: {
      ':hover': {
        backgroundColor: '#f0f0f0',
        borderColor: '#1e40af',
      },
    },
  },
  memberItemSelected: {
    padding: '12px',
    borderRadius: '4px',
    border: '2px solid #1e40af',
    backgroundColor: '#eff6ff',
    marginBottom: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontWeight: 600,
    fontSize: '13px',
  },
  memberRole: {
    fontSize: '11px',
    color: '#666',
  },
  accessInfo: {
    padding: '12px',
    backgroundColor: '#fef3c7',
    borderRadius: '4px',
    marginBottom: '16px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  sharedList: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#f0fdf4',
    borderRadius: '4px',
  },
  sharedTitle: {
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#166534',
  },
  sharedItem: {
    fontSize: '12px',
    color: '#166534',
    marginBottom: '4px',
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

type AccessLevel = 'Read' | 'ReadWrite';

const accessLevelOptions: IChoiceGroupOption[] = [
  {
    key: 'Read',
    text: 'Doar citire',
    iconProps: { iconName: 'View' },
  },
  {
    key: 'ReadWrite',
    text: 'Citire și scriere',
    iconProps: { iconName: 'Edit' },
  },
];

// ============================================================================
// Component
// ============================================================================

interface ThreadSharePanelProps {
  onShared?: (result: ShareResult) => void;
}

export function ThreadSharePanel({ onShared }: ThreadSharePanelProps) {
  const [emailInfo, setEmailInfo] = useState<EmailInfo | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('Read');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recentShares, setRecentShares] = useState<ShareResult[]>([]);

  // Load email info and team members on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current email info
      const info = await outlookApi.getEmailInfo();
      setEmailInfo(info);

      // Get team members
      const members = await apiClient.getTeamMembers();
      setTeamMembers(members);
    } catch (err) {
      console.error('[ThreadSharePanel] Failed to load data:', err);
      setError('Nu s-au putut încărca datele. Verificați conexiunea.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedMemberId || !emailInfo?.conversationId) {
      setError('Selectați un coleg pentru partajare.');
      return;
    }

    setSharing(true);
    setError(null);

    try {
      const result = await apiClient.shareEmailThread({
        conversationId: emailInfo.conversationId,
        sharedWithUserId: selectedMemberId,
        accessLevel,
      });

      if (result.success) {
        setSuccess(`Conversația a fost partajată cu ${result.sharedWithName}`);
        setRecentShares((prev) => [...prev, result]);
        setSelectedMemberId(null);
        onShared?.(result);
      }
    } catch (err) {
      console.error('[ThreadSharePanel] Failed to share thread:', err);
      setError((err as Error).message || 'Nu s-a putut partaja conversația.');
    } finally {
      setSharing(false);
    }
  };

  // Filter team members by search query
  const filteredMembers = teamMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading state
  if (loading) {
    return (
      <Stack className={styles.container} horizontalAlign="center" verticalAlign="center">
        <Spinner size={SpinnerSize.large} label="Se încarcă..." />
      </Stack>
    );
  }

  // No email or no conversation ID
  if (!emailInfo || !emailInfo.conversationId) {
    return (
      <Stack className={styles.noEmail}>
        <Icon iconName="Mail" className={styles.noEmailIcon} />
        <Text variant="large">Niciun email selectat</Text>
        <Text variant="small" style={{ marginTop: '8px', color: '#666' }}>
          Selectați un email în Outlook pentru a partaja conversația.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack className={styles.container}>
      {/* Header */}
      <Text variant="xLarge" className={styles.header}>
        Partajează Conversația
      </Text>

      {/* Email/Thread Info */}
      <div className={styles.emailInfo}>
        <div className={styles.emailSubject}>{emailInfo.subject || '(Fără subiect)'}</div>
        <div className={styles.threadInfo}>
          <Icon iconName="Mail" style={{ fontSize: '12px' }} />
          Conversație completă
        </div>
      </div>

      {/* Access Info */}
      <div className={styles.accessInfo}>
        <Icon iconName="Info" style={{ marginTop: '2px' }} />
        <div>
          <strong>Notă:</strong> Colegul va avea acces la întreaga conversație email, inclusiv toate
          mesajele din acest thread care v-au fost sincronizate.
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

      {/* Team Member Selection */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Icon iconName="People" />
          Selectează Coleg
        </div>
        <SearchBox
          placeholder="Caută după nume sau email..."
          value={searchQuery}
          onChange={(_, value) => setSearchQuery(value || '')}
          style={{ marginBottom: '8px' }}
        />
        <div className={styles.memberList}>
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className={
                selectedMemberId === member.id ? styles.memberItemSelected : styles.memberItem
              }
              onClick={() => setSelectedMemberId(member.id)}
            >
              <Persona
                text={member.name}
                secondaryText={member.email}
                size={PersonaSize.size32}
                hidePersonaDetails
              />
              <div className={styles.memberInfo}>
                <div className={styles.memberName}>{member.name}</div>
                <div className={styles.memberRole}>
                  {member.role} • {member.email}
                </div>
              </div>
              {selectedMemberId === member.id && (
                <Icon iconName="CheckMark" style={{ color: '#1e40af' }} />
              )}
            </div>
          ))}
          {filteredMembers.length === 0 && (
            <Text variant="small" style={{ color: '#666', padding: '8px' }}>
              Niciun coleg găsit.
            </Text>
          )}
        </div>
      </div>

      {/* Access Level */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Icon iconName="Permissions" />
          Nivel de Acces
        </div>
        <ChoiceGroup
          selectedKey={accessLevel}
          options={accessLevelOptions}
          onChange={(_, option) => option && setAccessLevel(option.key as AccessLevel)}
        />
      </div>

      {/* Recent Shares */}
      {recentShares.length > 0 && (
        <div className={styles.sharedList}>
          <div className={styles.sharedTitle}>
            <Icon iconName="CheckMark" /> Partajat în această sesiune:
          </div>
          {recentShares.map((share, index) => (
            <div key={index} className={styles.sharedItem}>
              • {share.sharedWithName}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <PrimaryButton
          text="Partajează"
          onClick={handleShare}
          disabled={!selectedMemberId || sharing}
          iconProps={{ iconName: sharing ? 'Sync' : 'Share' }}
        />
        <DefaultButton
          text="Anulează"
          onClick={() => setSelectedMemberId(null)}
          iconProps={{ iconName: 'Cancel' }}
        />
      </div>
    </Stack>
  );
}
