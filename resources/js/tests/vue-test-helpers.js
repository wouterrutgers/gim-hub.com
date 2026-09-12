import { createApp } from "vue";
import { createPinia, disposePinia } from "pinia";

const applications = new Set();
const piniaInstances = new Set();

export function createTestApplication(component, props) {
  const application = createApp(component, props);
  applications.add(application);
  application.onUnmount(function unregisterApplication() {
    applications.delete(application);
  });

  return application;
}

export function createTestPinia() {
  const pinia = createPinia();
  piniaInstances.add(pinia);

  return pinia;
}

export function cleanupVue() {
  for (const application of applications) {
    application.unmount();
  }

  for (const pinia of piniaInstances) {
    disposePinia(pinia);
  }

  piniaInstances.clear();
}
