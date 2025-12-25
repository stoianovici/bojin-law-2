/**
 * Case Section Components
 * Part of Expandable Case Workspace Epic (OPS-207 to OPS-217)
 * OPS-225: Added SectionGroup for collapsible section grouping
 */

export { BillingSection } from './BillingSection';
export { CaseDetailsSection } from './CaseDetailsSection';
export type { CaseDetailsSectionProps } from './CaseDetailsSection';
export { ContactsSection } from './ContactsSection';
export type { ContactsSectionProps } from './ContactsSection';
export { ReferencesSection, parseReferencesFromMetadata } from './ReferencesSection';
export type { ReferencesSectionProps, CaseReference } from './ReferencesSection';
export { SectionGroup } from './SectionGroup';
export type { SectionGroupProps, SectionGroupVariant } from './SectionGroup';
