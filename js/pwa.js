let deferredInstallPrompt = null;

function isAppInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function notifyPwaChange(detail = {}) {
  window.dispatchEvent(new CustomEvent("budget:pwa-change", {
    detail: {
      canInstall: Boolean(deferredInstallPrompt),
      installed: isAppInstalled(),
      online: navigator.onLine,
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
    notifyPwaChange({ manualInstall: true });
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
  getState() {
    return {
      canInstall: Boolean(deferredInstallPrompt),
      installed: isAppInstalled(),
      online: navigator.onLine
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
