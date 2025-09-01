import { projectStatusConfig } from './projectStatus';
import { projectStageConfig } from './projectStage';
import { taskStatusConfig } from './taskStatus';
import { taskStageConfig } from './taskStage';
import { businessLevelConfig } from './businessLevelConfig';
import { locationLevelConfig } from './locationLevelConfig';
import { hrLevelConfig } from './hrLevelConfig';

export const META_CONFIGS = {
  'projectStatus': projectStatusConfig,
  'projectStage': projectStageConfig,
  'taskStatus': taskStatusConfig,
  'taskStage': taskStageConfig,
  'businessLevel': businessLevelConfig,
  'locationLevel': locationLevelConfig,
  'hrLevel': hrLevelConfig,
} as const;

export type MetaEntityType = keyof typeof META_CONFIGS;