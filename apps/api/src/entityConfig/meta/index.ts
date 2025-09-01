import { projectStatusConfig } from './projectStatus.js';
import { projectStageConfig } from './projectStage.js';
import { taskStatusConfig } from './taskStatus.js';
import { taskStageConfig } from './taskStage.js';
import { businessLevelConfig } from './businessLevel.js';
import { locationLevelConfig } from './locationLevel.js';
import { hrLevelConfig } from './hrLevel.js';

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