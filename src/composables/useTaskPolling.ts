import { ref, onUnmounted } from 'vue'

/**
 * 通用任务轮询 Composable
 * @param fetchFn 执行获取数据的异步函数
 * @param checkGeneratingFn 检查是否还有正在生成的任务的函数
 * @param interval 轮询间隔 (ms)，默认 3000
 */
export function useTaskPolling(
    fetchFn: () => Promise<void>,
    checkGeneratingFn: () => boolean,
    interval = 3000
) {
    const pollTimer = ref<ReturnType<typeof setInterval> | null>(null)

    function stopPolling() {
        if (pollTimer.value) {
            clearInterval(pollTimer.value)
            pollTimer.value = null
        }
    }

    function startPolling() {
        if (pollTimer.value) return

        // 立即执行一次
        fetchFn().then(() => {
            if (!checkGeneratingFn()) {
                return
            }

            pollTimer.value = setInterval(async () => {
                await fetchFn()
                if (!checkGeneratingFn()) {
                    stopPolling()
                }
            }, interval)
        })
    }

    onUnmounted(() => {
        stopPolling()
    })

    return {
        startPolling,
        stopPolling,
        isPolling: () => !!pollTimer.value
    }
}
