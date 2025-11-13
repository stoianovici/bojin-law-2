/**
 * UI Component Library
 * Design system with Romanian diacritic support (ă, â, î, ș, ț)
 */

// Import styles
import './styles.css';

// Export components
export { Button } from './atoms/Button';

export { Input } from './atoms/Input';
export { Textarea } from './atoms/Textarea';
export { Card } from './atoms/Card';
export { Tooltip } from './atoms/Tooltip';

export { Modal } from './molecules/Modal';

// Re-export types from shared package
export type {
  ButtonVariant,
  CardVariant,
  InputValidationState,
  ModalSize,
  TooltipPosition,
  ComponentSize,
  InputProps,
  TextareaProps,
  CardProps,
  ModalProps,
  TooltipProps,
} from '@legal-platform/types';
