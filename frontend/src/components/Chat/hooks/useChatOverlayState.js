import { useState } from "react";

function useChatOverlayState() {
  const [contextMenu, setContextMenu] = useState(null);
  const [settingsModal, setSettingsModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const openContextMenu = (event, config) => {
    setContextMenu({
      ...config,
      position: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  };

  const closeContextMenu = () => setContextMenu(null);
  const openSettingsModal = (config) => setSettingsModal(config);
  const closeSettingsModal = () => setSettingsModal(null);
  const openConfirmModal = (config) => setConfirmModal(config);
  const closeConfirmModal = () => setConfirmModal(null);

  return {
    contextMenu,
    settingsModal,
    confirmModal,
    openContextMenu,
    closeContextMenu,
    openSettingsModal,
    closeSettingsModal,
    openConfirmModal,
    closeConfirmModal,
  };
}

export default useChatOverlayState;
