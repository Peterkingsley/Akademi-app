import { create } from "zustand";
import { ProtectedDestination } from "../navigation/types";

type AcademicSetupState = {
  pendingDestination: ProtectedDestination | null;
  deferNextGate: boolean;
  setPendingDestination: (destination: ProtectedDestination | null) => void;
  clearPendingDestination: () => void;
  deferGateOnce: () => void;
  consumeDeferredGate: () => boolean;
};

export const useAcademicSetupStore = create<AcademicSetupState>((set) => ({
  pendingDestination: null,
  deferNextGate: false,
  setPendingDestination: (pendingDestination) => set({ pendingDestination }),
  clearPendingDestination: () => set({ pendingDestination: null }),
  deferGateOnce: () => set({ deferNextGate: true }),
  consumeDeferredGate: () => {
    const deferred = useAcademicSetupStore.getState().deferNextGate;
    if (deferred) set({ deferNextGate: false });
    return deferred;
  },
}));
