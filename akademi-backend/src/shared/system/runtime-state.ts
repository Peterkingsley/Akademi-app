type RuntimeState = {
  startedAt: string;
  startupCompletedAt: string | null;
  shuttingDown: boolean;
  shutdownReason: string | null;
};

const runtimeState: RuntimeState = {
  startedAt: new Date().toISOString(),
  startupCompletedAt: null,
  shuttingDown: false,
  shutdownReason: null,
};

export const markStartupComplete = () => {
  runtimeState.startupCompletedAt = new Date().toISOString();
};

export const markShuttingDown = (reason: string) => {
  runtimeState.shuttingDown = true;
  runtimeState.shutdownReason = reason;
};

export const getRuntimeState = () => ({ ...runtimeState });

