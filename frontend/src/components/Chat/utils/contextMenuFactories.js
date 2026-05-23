export function buildServerContextMenuItems({
  canDelete,
  onOpenModeration,
  onOpenSettings,
  onOpenDeleteConfirm,
  onLeave,
}) {
  return [
    ...(onOpenModeration
      ? [
          {
            key: "moderation",
            label: "멤버 관리",
            icon: "👥",
            onClick: onOpenModeration,
          },
        ]
      : []),
    {
      key: "settings",
      label: "설정",
      icon: "⚙️",
      onClick: onOpenSettings,
    },
    ...(canDelete
      ? [
          {
            key: "delete",
            label: "서버 삭제",
            icon: "🗑️",
            danger: true,
            onClick: onOpenDeleteConfirm,
          },
        ]
      : [
          {
            key: "leave",
            label: "서버 나가기",
            icon: "🚪",
            danger: true,
            onClick: onLeave,
          },
        ]),
  ];
}

export function buildChannelContextMenuItems({
  onOpenSettings,
  onOpenDeleteConfirm,
}) {
  return [
    {
      key: "settings",
      label: "설정",
      icon: "⚙️",
      onClick: onOpenSettings,
    },
    {
      key: "delete",
      label: "채널 삭제",
      icon: "🗑️",
      danger: true,
      onClick: onOpenDeleteConfirm,
    },
  ];
}
