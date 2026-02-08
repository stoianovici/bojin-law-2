/**
 * TaskPane - Main Outlook Add-in Component
 *
 * Tab-based interface for email management:
 * - Asociază: Link emails to cases
 * - Clasifică: Pre-triage and tagging
 * - Partajează: Share threads with colleagues
 */

import { useState } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  Pivot,
  PivotItem,
  Spinner,
  SpinnerSize,
  Icon,
  mergeStyleSets,
  MessageBar,
  MessageBarType,
} from '@fluentui/react';
import { useAuth } from '../services/auth';
import { CaseLinkPanel } from '../components/CaseLinkPanel';
import { TriagePanel } from '../components/TriagePanel';
import { ThreadSharePanel } from '../components/ThreadSharePanel';

// ============================================================================
// Styles
// ============================================================================

const styles = mergeStyleSets({
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#1e40af',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoText: {
    fontWeight: 600,
    fontSize: '16px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
  pivot: {
    borderBottom: '1px solid #e0e0e0',
  },
  pivotContent: {
    padding: '0',
  },
  loginContainer: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    textAlign: 'center' as const,
  },
  loginLogo: {
    width: '80px',
    height: '80px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e40af',
    borderRadius: '16px',
    color: 'white',
    fontSize: '32px',
  },
  loginTitle: {
    marginBottom: '8px',
  },
  loginDescription: {
    color: '#666',
    marginBottom: '24px',
    maxWidth: '300px',
  },
  footer: {
    padding: '8px 16px',
    borderTop: '1px solid #e0e0e0',
    backgroundColor: '#fafafa',
    fontSize: '11px',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

// ============================================================================
// Component
// ============================================================================

export function TaskPane() {
  const { isAuthenticated, user, loading, error, login, logout } = useAuth();
  const [selectedTab, setSelectedTab] = useState('link');

  // Handle tab change
  const handleTabChange = (item?: PivotItem) => {
    if (item) {
      setSelectedTab(item.props.itemKey || 'link');
    }
  };

  // Loading state
  if (loading) {
    return (
      <Stack className={styles.loginContainer}>
        <Spinner size={SpinnerSize.large} label="Se autentifică..." />
      </Stack>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return (
      <Stack className={styles.loginContainer}>
        <div className={styles.loginLogo}>
          <Icon iconName="Gavel" />
        </div>
        <Text variant="xLarge" className={styles.loginTitle}>
          Bojin Legal
        </Text>
        <Text variant="medium" className={styles.loginDescription}>
          Gestionați email-urile direct din Outlook. Asociați la dosare, clasificați și partajați cu
          colegii.
        </Text>

        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            dismissButtonAriaLabel="Închide"
            style={{ marginBottom: '16px', maxWidth: '300px' }}
          >
            {error}
          </MessageBar>
        )}

        <PrimaryButton
          text="Autentificare"
          onClick={login}
          iconProps={{ iconName: 'Signin' }}
          styles={{ root: { minWidth: '200px' } }}
        />
      </Stack>
    );
  }

  // Authenticated - show main UI
  return (
    <Stack className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.logo}>
          <Icon iconName="Gavel" style={{ fontSize: '20px' }} />
          <span className={styles.logoText}>Bojin Legal</span>
        </div>
        <div className={styles.userInfo}>
          <Icon iconName="Contact" />
          <span>{user?.name || user?.email}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <Pivot
        className={styles.pivot}
        selectedKey={selectedTab}
        onLinkClick={handleTabChange}
        styles={{
          root: { paddingLeft: '8px' },
          link: { height: '44px' },
          linkIsSelected: { height: '44px' },
        }}
      >
        <PivotItem headerText="Asociază" itemKey="link" itemIcon="Link" />
        <PivotItem headerText="Clasifică" itemKey="triage" itemIcon="Tag" />
        <PivotItem headerText="Partajează" itemKey="share" itemIcon="Share" />
      </Pivot>

      {/* Content */}
      <div className={styles.content}>
        {selectedTab === 'link' && <CaseLinkPanel />}
        {selectedTab === 'triage' && <TriagePanel />}
        {selectedTab === 'share' && <ThreadSharePanel />}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span>Bojin Legal v1.0</span>
        <span onClick={logout} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
          Deconectare
        </span>
      </div>
    </Stack>
  );
}
