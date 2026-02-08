/**
 * Case Link Panel
 *
 * Main panel for linking emails to cases.
 * Shows case suggestions and allows manual case selection.
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
  mergeStyleSets,
} from '@fluentui/react';
import { outlookApi, EmailInfo } from '../services/outlook-api';
import { apiClient, CaseSuggestion, ActiveCase, EmailSyncStatus } from '../services/api-client';

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
  suggestionItem: {
    padding: '12px',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
    marginBottom: '8px',
    cursor: 'pointer',
    selectors: {
      ':hover': {
        backgroundColor: '#f0f0f0',
        borderColor: '#1e40af',
      },
    },
  },
  suggestionItemSelected: {
    padding: '12px',
    borderRadius: '4px',
    border: '2px solid #1e40af',
    backgroundColor: '#eff6ff',
    marginBottom: '8px',
    cursor: 'pointer',
  },
  suggestionTitle: {
    fontWeight: 600,
    fontSize: '13px',
  },
  suggestionMeta: {
    fontSize: '11px',
    color: '#666',
    marginTop: '4px',
  },
  confidenceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 6px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 600,
    marginLeft: '8px',
  },
  highConfidence: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  mediumConfidence: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  lowConfidence: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  syncedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: '#dcfce7',
    color: '#166534',
    borderRadius: '4px',
    fontSize: '12px',
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
// Component
// ============================================================================

interface CaseLinkPanelProps {
  onLinked?: () => void;
}

export function CaseLinkPanel({ onLinked }: CaseLinkPanelProps) {
  const [emailInfo, setEmailInfo] = useState<EmailInfo | null>(null);
  const [syncStatus, setSyncStatus] = useState<EmailSyncStatus | null>(null);
  const [suggestions, setSuggestions] = useState<CaseSuggestion[]>([]);
  const [allCases, setAllCases] = useState<ActiveCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load email info and suggestions on mount
  useEffect(() => {
    loadEmailData();
  }, []);

  const loadEmailData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current email info from Outlook
      const info = await outlookApi.getEmailInfo();
      setEmailInfo(info);

      if (!info) {
        setLoading(false);
        return;
      }

      // Check sync status
      if (info.internetMessageId) {
        const status = await apiClient.getEmailSyncStatus(info.internetMessageId);
        setSyncStatus(status);

        // If already linked, pre-select the case
        if (status.caseId) {
          setSelectedCaseId(status.caseId);
        }

        // Get case suggestions
        if (info.from?.emailAddress) {
          const caseSuggestions = await apiClient.suggestCasesForEmail(
            info.internetMessageId,
            info.from.emailAddress,
            info.subject
          );
          setSuggestions(caseSuggestions);
        }
      }

      // Load all cases for manual selection
      const cases = await apiClient.getActiveCases();
      setAllCases(cases);
    } catch (err) {
      console.error('[CaseLinkPanel] Failed to load email data:', err);
      setError('Nu s-au putut încărca datele. Verificați conexiunea.');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkToCase = async () => {
    if (!selectedCaseId || !emailInfo) {
      setError('Selectați un dosar pentru a asocia email-ul.');
      return;
    }

    setLinking(true);
    setError(null);

    try {
      const result = await apiClient.linkEmailFromOutlook({
        internetMessageId: emailInfo.internetMessageId || '',
        conversationId: emailInfo.conversationId || undefined,
        caseId: selectedCaseId,
        subject: emailInfo.subject,
        senderEmail: emailInfo.from?.emailAddress || '',
        senderName: emailInfo.from?.displayName,
        bodyPreview: emailInfo.bodyPreview,
        receivedDateTime: emailInfo.dateTimeReceived?.toISOString(),
      });

      if (result.success) {
        setSuccess(`Email asociat cu succes la dosarul "${result.caseName}"`);
        setSyncStatus({
          isSynced: true,
          emailId: result.emailId,
          caseId: result.caseId,
          caseName: result.caseName,
          classificationState: 'Classified',
        });
        onLinked?.();
      }
    } catch (err) {
      console.error('[CaseLinkPanel] Failed to link email:', err);
      setError((err as Error).message || 'Nu s-a putut asocia email-ul.');
    } finally {
      setLinking(false);
    }
  };

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 0.8) return styles.highConfidence;
    if (confidence >= 0.5) return styles.mediumConfidence;
    return styles.lowConfidence;
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'Înalt';
    if (confidence >= 0.5) return 'Mediu';
    return 'Scăzut';
  };

  // Filter cases by search query
  const filteredCases = allCases.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          Selectați un email în Outlook pentru a-l asocia la un dosar.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack className={styles.container}>
      {/* Header */}
      <Text variant="xLarge" className={styles.header}>
        Asociază la Dosar
      </Text>

      {/* Email Info */}
      <div className={styles.emailInfo}>
        <div className={styles.emailSubject}>{emailInfo.subject || '(Fără subiect)'}</div>
        <div className={styles.emailFrom}>
          De la: {emailInfo.from?.displayName || emailInfo.from?.emailAddress || 'Necunoscut'}
        </div>
        {syncStatus?.isSynced && (
          <div style={{ marginTop: '8px' }}>
            <span className={styles.syncedBadge}>
              <Icon iconName="CheckMark" />
              Sincronizat
              {syncStatus.caseName && ` - ${syncStatus.caseName}`}
            </span>
          </div>
        )}
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

      {/* Case Suggestions */}
      {suggestions.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Icon iconName="LightBulb" />
            Sugestii Dosare
          </div>
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={
                selectedCaseId === suggestion.id
                  ? styles.suggestionItemSelected
                  : styles.suggestionItem
              }
              onClick={() => setSelectedCaseId(suggestion.id)}
            >
              <div className={styles.suggestionTitle}>
                {suggestion.title}
                <span
                  className={`${styles.confidenceBadge} ${getConfidenceClass(suggestion.confidence)}`}
                >
                  {getConfidenceLabel(suggestion.confidence)}
                </span>
              </div>
              <div className={styles.suggestionMeta}>
                {suggestion.caseNumber}
                {suggestion.clientName && ` • ${suggestion.clientName}`}
                {' • '}
                {suggestion.matchReason}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Case Selection */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Icon iconName="Search" />
          Selectare Manuală
        </div>
        <SearchBox
          placeholder="Caută după nume, număr dosar sau client..."
          value={searchQuery}
          onChange={(_, value) => setSearchQuery(value || '')}
          style={{ marginBottom: '8px' }}
        />
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {filteredCases.slice(0, 10).map((caseItem) => (
            <div
              key={caseItem.id}
              className={
                selectedCaseId === caseItem.id
                  ? styles.suggestionItemSelected
                  : styles.suggestionItem
              }
              onClick={() => setSelectedCaseId(caseItem.id)}
            >
              <div className={styles.suggestionTitle}>{caseItem.title}</div>
              <div className={styles.suggestionMeta}>
                {caseItem.caseNumber}
                {caseItem.clientName && ` • ${caseItem.clientName}`}
              </div>
            </div>
          ))}
          {filteredCases.length === 0 && (
            <Text variant="small" style={{ color: '#666', padding: '8px' }}>
              Niciun dosar găsit.
            </Text>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <PrimaryButton
          text={syncStatus?.isSynced ? 'Actualizează Asociere' : 'Asociază la Dosar'}
          onClick={handleLinkToCase}
          disabled={!selectedCaseId || linking}
          iconProps={{ iconName: linking ? 'Sync' : 'Link' }}
        />
        <DefaultButton
          text="Reîncarcă"
          onClick={loadEmailData}
          iconProps={{ iconName: 'Refresh' }}
        />
      </div>
    </Stack>
  );
}
