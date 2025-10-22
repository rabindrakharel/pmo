/**
 * Universal Designer System
 *
 * A unified, scalable design framework for all content creation and editing in the PMO platform.
 *
 * @module designer
 */

export { UniversalDesigner } from './UniversalDesigner';
export type { UniversalDesignerProps, DesignerViewMode, DesignerAction } from './UniversalDesigner';

export { UniversalBlock, UniversalBlockContainer } from './UniversalBlock';
export type { UniversalBlockProps, UniversalBlockContainerProps } from './UniversalBlock';

export {
  InlineText,
  InlineTextarea,
  InlineSelect,
  InlineNumber,
  InlineDate,
} from './InlineEdit';
