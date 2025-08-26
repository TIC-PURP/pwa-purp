import {
  useSelector,
  useDispatch,
  type TypedUseSelectorHook,
} from "react-redux";
import type { RootState, AppDispatch } from "./store";

// Atajos tipados para trabajar con Redux
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
