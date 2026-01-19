/**
 * StepTemplate Component
 * Step 2 placeholder for "Șablon" creation type.
 *
 * Shows "Coming Soon" message with template grid skeleton.
 */

// ============================================================================
// Types
// ============================================================================

interface StepTemplateProps {
  onBack?: () => void; // Optional - not shown when in preset context mode
}

// ============================================================================
// Component
// ============================================================================

export function StepTemplate({ onBack }: StepTemplateProps) {
  return (
    <div className="wizard-step step-template">
      {/* Coming Soon */}
      <div className="coming-soon-container">
        <div className="coming-soon-badge">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>În curând</span>
        </div>
        <p className="coming-soon-text">
          Șabloanele predefinite vor fi disponibile în curând. Veți putea selecta din contracte,
          cereri, întâmpinări și alte documente tipice, care vor fi completate automat cu datele din
          contextul dosarului.
        </p>
      </div>

      {/* Template Grid Skeleton */}
      <div className="template-grid-skeleton">
        <div className="template-skeleton-card">
          <div className="skeleton-icon"></div>
          <div className="skeleton-title"></div>
          <div className="skeleton-desc"></div>
        </div>
        <div className="template-skeleton-card">
          <div className="skeleton-icon"></div>
          <div className="skeleton-title"></div>
          <div className="skeleton-desc"></div>
        </div>
        <div className="template-skeleton-card">
          <div className="skeleton-icon"></div>
          <div className="skeleton-title"></div>
          <div className="skeleton-desc"></div>
        </div>
        <div className="template-skeleton-card">
          <div className="skeleton-icon"></div>
          <div className="skeleton-title"></div>
          <div className="skeleton-desc"></div>
        </div>
      </div>

      {/* Navigation */}
      {onBack && (
        <div className="wizard-nav">
          <button className="btn btn-secondary" onClick={onBack} style={{ width: '100%' }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ marginRight: 8 }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Înapoi
          </button>
        </div>
      )}
    </div>
  );
}
