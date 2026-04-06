const SW_PATH = "/sw.js"

export function registerPwaServiceWorker() {
  if (!import.meta.env.PROD) {
    return
  }

  if (!("serviceWorker" in navigator)) {
    return
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_PATH).catch((error) => {
      console.warn("Failed to register service worker", error)
    })
  })
}
