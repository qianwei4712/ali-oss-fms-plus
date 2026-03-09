import { create } from 'zustand';

interface UiState {
  isNavBarVisible: boolean;
  setNavBarVisible: (visible: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isNavBarVisible: true,
  setNavBarVisible: (visible) => set({ isNavBarVisible: visible }),
}));
