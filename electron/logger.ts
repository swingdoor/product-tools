import dayjs from 'dayjs'
import { execSync } from 'child_process'

// 在 Windows 环境下强制终端使用 UTF-8 (Code Page 65001)
if (process.platform === 'win32') {
    try {
        execSync('chcp 65001 > nul')
    } catch (e) {
        // 忽略错误
    }
}

/**
 * 标准化终端日志输出
 * 格式: [YYYY-MM-DD HH:mm:ss] [模块名] 内容
 */
export const logger = {
    info(module: string, message: string, detail?: string) {
        const time = dayjs().format('YYYY-MM-DD HH:mm:ss')
        const detailStr = detail ? ` | ${detail}` : ''
        console.log(`[${time}] [${module}] ${message}${detailStr}`)
    },

    error(module: string, message: string, detail?: string) {
        const time = dayjs().format('YYYY-MM-DD HH:mm:ss')
        const detailStr = detail ? ` | Detail: ${detail}` : ''
        console.error(`[${time}] [${module}] ❌ ${message}${detailStr}`)
    },

    warn(module: string, message: string) {
        const time = dayjs().format('YYYY-MM-DD HH:mm:ss')
        console.warn(`[${time}] [${module}] ⚠️ ${message}`)
    }
}
