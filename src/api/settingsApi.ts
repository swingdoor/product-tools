import { invokeApi } from './client'

export const settingsApi = {
    getConfig: () => invokeApi<any>(() => window.electronAPI.configGet()),
    saveConfig: (settings: any) => invokeApi<any>(() => window.electronAPI.configSave(settings)),
    getConfigPath: () => invokeApi<string>(() => window.electronAPI.configGetPath()),
    dataClearMarket: () => invokeApi<void>(() => window.electronAPI.dataClearMarket()),
    dataClearAnalysis: () => invokeApi<void>(() => window.electronAPI.dataClearAnalysis()),
    dataClearPrototype: () => invokeApi<void>(() => window.electronAPI.dataClearPrototype()),
    dataClearDesign: () => invokeApi<void>(() => window.electronAPI.dataClearDesign()),
    openConfigFolder: () => invokeApi<boolean>(() => window.electronAPI.appOpenConfigFolder()),
}
