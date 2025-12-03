import { projectStatusConfig } from './projectStatus';
import { projectStageConfig } from './projectStage';
import { taskStatusConfig } from './taskStatus';
import { taskStageConfig } from './taskStage';
import { businessLevelConfig } from './businessLevelConfig';
import { orgLevelConfig } from './orgLevelConfig';
import { hrLevelConfig } from './hrLevelConfig';

// Import main entity configs
import { projectConfig } from './projectConfig';
import { taskConfig } from './taskConfig';
import { formConfig } from './formConfig';
import { artifactConfig } from './artifactConfig';
import { wikiConfig } from './wikiConfig';
import { businessConfig } from './businessConfig';

export const META_CONFIGS = {
  // Meta/lookup entities
  'projectStatus': projectStatusConfig,
  'projectStage': projectStageConfig,
  'taskStatus': taskStatusConfig,
  'taskStage': taskStageConfig,
  'businessLevel': businessLevelConfig,
  'orgLevel': orgLevelConfig,
  'hrLevel': hrLevelConfig,

  // Main entities
  'project': projectConfig,
  'task': taskConfig,
  'form': formConfig,
  'artifact': artifactConfig,
  'wiki': wikiConfig,
  'business': businessConfig,
} as const;

export type MetaEntityType = keyof typeof META_CONFIGS;