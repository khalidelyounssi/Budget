let deferredInstallPrompt = null;

function isIosDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTouchMac = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;

  return /iphone|ipad|ipod/.test(userAgent) || isTouchMac;
}

function isAppInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function notifyPwaChange(detail = {}) {
  window.dispatchEvent(new CustomEvent("budget:pwa-change", {
    detail: {
      canInstall: Boolean(deferredInstallPrompt),
      installed: isAppInstalled(),
      online: navigator.onLine,
      platform: isIosDevice() ? "ios" : "standard",
      ...detail
    }
  }));
}

async function installApp() {
  if (isAppInstalled()) {
    notifyPwaChange({ installed: true });
    return { status: "installed" };
  }

  if (!deferredInstallPrompt) {
    notifyPwaChange({ manualInstall: true, platform: isIosDevice() ? "ios" : "standard" });
    return { status: "manual" };
  }

  deferredInstallPrompt.prompt();
  const choiceResult = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  notifyPwaChange();

  return {
    status: choiceResult.outcome === "accepted" ? "accepted" : "dismissed"
  };
}

window.BudgetPwa = {
  installApp,
  isAppInstalled,
  isIosDevice,
  getState() {
    return {
      canInstall: Boolean(deferredInstallPrompt),
      installed: isAppInstalled(),
      online: navigator.onLine,
      platform: isIosDevice() ? "ios" : "standard"
    };
  }
};

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  notifyPwaChange();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  notifyPwaChange({ installed: true, installedNow: true });
});

window.addEventListener("offline", () => {
  notifyPwaChange({ offlineNow: true });
});

window.addEventListener("online", () => {
  notifyPwaChange({ onlineNow: true });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("service-worker.js");
      console.log("Service Worker registered:", registration.scope);
    } catch (error) {
      console.error("Service Worker registration failed:", error);
    }
  });
}

window.addEventListener("load", () => {
  notifyPwaChange();
});
