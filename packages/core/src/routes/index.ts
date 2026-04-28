/**
 * API routes exports
 */

import telemetry from "./telemetry.js";
import dashboard from "./dashboard.js";
import alerts from "./alerts.js";
import auth from "./auth.js";
import system from "./system.js";
import crash from "./crash.js";

export const routes = {
  telemetry,
  dashboard,
  alerts,
  auth,
  system,
  crash,
};

export default routes;