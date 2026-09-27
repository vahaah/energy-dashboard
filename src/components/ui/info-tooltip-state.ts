export type InfoTooltipAction =
  | { type: "hover-enter" }
  | { type: "hover-leave"; focused: boolean }
  | { type: "focus" }
  | { type: "blur" }
  | { type: "click" }
  | { type: "escape" };

export type InfoTooltipState = {
  open: boolean;
  suppressClick: boolean;
};

export const initialInfoTooltipState: InfoTooltipState = {
  open: false,
  suppressClick: false,
};

export function reduceInfoTooltip(
  state: InfoTooltipState,
  action: InfoTooltipAction
): InfoTooltipState {
  switch (action.type) {
    case "hover-enter":
      return { open: true, suppressClick: true };
    case "hover-leave":
      return action.focused ? state : { open: false, suppressClick: false };
    case "focus":
      return { open: true, suppressClick: true };
    case "blur":
      return { open: false, suppressClick: false };
    case "click":
      if (state.suppressClick) {
        return { ...state, suppressClick: false };
      }
      return { ...state, open: !state.open };
    case "escape":
      return { open: false, suppressClick: false };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
