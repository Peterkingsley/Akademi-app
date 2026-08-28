import React, { useCallback } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { ProtectedDestination } from "../../navigation/types";
import { userService } from "../../services/user";
import { useAcademicSetupStore } from "../../store/useAcademicSetupStore";
import { useAuthStore } from "../../store/useAuthStore";

const isAcademicProfileComplete = (user: { university?: string | null; faculty?: string | null; department?: string | null; level?: number | null }) =>
  Boolean(user.university && user.faculty && user.department && user.level);

export const withAcademicSetupGuard = <Props extends object>(Component: React.ComponentType<Props>, destination: ProtectedDestination | ((props: Props) => ProtectedDestination)): React.FC<Props> => {
  const GuardedComponent: React.FC<Props> = (props) => {
    const navigation = useNavigation<any>();
    const user = useAuthStore((state) => state.user);
    const updateUser = useAuthStore((state) => state.updateUser);

    useFocusEffect(useCallback(() => {
      let active = true;
      const guard = async () => {
        if (!user || isAcademicProfileComplete(user)) return;
        if (useAcademicSetupStore.getState().consumeDeferredGate()) return;
        try {
          const latestUser = await userService.getProfile();
          if (!active) return;
          updateUser(latestUser);
          if (!isAcademicProfileComplete(latestUser)) navigation.navigate("AcademicSetupGate", { destination: typeof destination === "function" ? destination(props) : destination });
        } catch {
          if (active) navigation.navigate("AcademicSetupGate", { destination: typeof destination === "function" ? destination(props) : destination });
        }
      };
      void guard();
      return () => { active = false; };
    }, [destination, navigation, updateUser, user]));

    return <Component {...props} />;
  };
  return GuardedComponent;
};
