// Clients components barrel export
export {
  CompanyDetailsForm,
  validateCUI,
  validateRegistrationNumber,
  validateCompanyDetails,
} from './CompanyDetailsForm';
export type {
  CompanyDetails,
  CompanyType,
  ClientType,
  Administrator,
  Contact,
} from './CompanyDetailsForm';

export { ClientListPanel, type ClientListData } from './ClientListPanel';
export { ClientListItem } from './ClientListItem';
export { ClientDetailPanel } from './ClientDetailPanel';
export { DeleteClientDialog } from './DeleteClientDialog';
export { CreateClientDialog } from './CreateClientDialog';
