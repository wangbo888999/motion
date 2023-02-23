import { resize } from "../resize"
import { createScrollInfo } from "./info"
import { createOnScrollHandler } from "./on-scroll-handler"
import { OnScroll, OnScrollHandler, ScrollOptions } from "./types"

const scrollListeners = new WeakMap<Element, VoidFunction>()
const resizeListeners = new WeakMap<Element, VoidFunction>()
const onScrollHandlers = new WeakMap<Element, Set<OnScrollHandler>>()

export type ScrollTargets = Array<HTMLElement>

const getEventTarget = (element: HTMLElement) =>
    element === document.documentElement ? window : element

export function scroll(
    onScroll: OnScroll,
    { container = document.documentElement, ...options }: ScrollOptions = {}
) {
    let containerHandlers = onScrollHandlers.get(container)

    /**
     * Get the onScroll handlers for this container.
     * If one isn't found, create a new one.
     */
    if (!containerHandlers) {
        containerHandlers = new Set()
        onScrollHandlers.set(container, containerHandlers)
    }

    /**
     * Create a new onScroll handler for the provided callback.
     */
    const info = createScrollInfo()
    const containerHandler = createOnScrollHandler(
        container,
        onScroll,
        info,
        options
    )
    containerHandlers.add(containerHandler)

    /**
     * Check if there's a scroll event listener for this container.
     * If not, create one.
     */
    if (!scrollListeners.has(container)) {
        const listener = () => {
            const time = performance.now()

            for (const handler of containerHandlers!) handler.measure()
            for (const handler of containerHandlers!) handler.update(time)
            for (const handler of containerHandlers!) handler.notify()
        }

        scrollListeners.set(container, listener)

        const target = getEventTarget(container)
        window.addEventListener("resize", listener, { passive: true })
        if (container !== document.documentElement) {
            resizeListeners.set(container, resize(container, listener))
        }
        target.addEventListener("scroll", listener, { passive: true })
    }

    const listener = scrollListeners.get(container)!
    const onLoadProcesss = requestAnimationFrame(listener)

    return () => {
        cancelAnimationFrame(onLoadProcesss)

        /**
         * Check if we even have any handlers for this container.
         */
        const currentHandlers = onScrollHandlers.get(container)
        if (!currentHandlers) return

        currentHandlers.delete(containerHandler)

        if (currentHandlers.size) return

        /**
         * If no more handlers, remove the scroll listener too.
         */
        const scrollListener = scrollListeners.get(container)
        scrollListeners.delete(container)

        if (scrollListener) {
            getEventTarget(container).removeEventListener(
                "scroll",
                scrollListener
            )
            resizeListeners.get(container)?.()
            window.removeEventListener("resize", scrollListener)
        }
    }
}
