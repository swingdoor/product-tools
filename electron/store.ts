export * from '../src/electron.d'

export { marketService as marketStore } from './services/marketService'
export { analysisService as analysisStore } from './services/analysisService'
export { projectService as projectStore } from './services/projectService'
export { designDocService as designDocStore } from './services/designDocService'
export { systemRepo as systemStore } from './db/repositories/systemRepo'

// For legacy backwards compatibility
export { marketService } from './services/marketService'
export { analysisService } from './services/analysisService'
export { projectService } from './services/projectService'
export { designDocService } from './services/designDocService'
export { systemRepo } from './db/repositories/systemRepo'
import { dbPath } from './db/connection'

export function getStorePath(): string {
  return dbPath
}

export function getConfigPath(): string {
  return dbPath
}
