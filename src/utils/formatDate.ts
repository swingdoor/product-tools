/**
 * 格式化日期字符串为 YYYY-MM-DD HH:mm:ss
 * @param dateStr ISO 日期字符串或其他可解析格式
 * @returns 格式化后的字符串，如果解析失败返回原字符串，如果为空返回 '-'
 */
export function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-'
    try {
        const date = new Date(dateStr)
        // 检查日期是否有效
        if (isNaN(date.getTime())) return dateStr

        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        const hh = String(date.getHours()).padStart(2, '0')
        const mm = String(date.getMinutes()).padStart(2, '0')
        const ss = String(date.getSeconds()).padStart(2, '0')

        return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
    } catch (e) {
        return dateStr
    }
}
