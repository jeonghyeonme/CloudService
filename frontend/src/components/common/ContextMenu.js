import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./ContextMenu.css";

const VIEWPORT_PADDING = 12;

function ContextMenu({ open, position, title, items = [], onClose }) {
  const menuRef = useRef(null);
  const [resolvedPosition, setResolvedPosition] = useState(position);

  useLayoutEffect(() => {
    if (!open || !menuRef.current || !position) {
      if (!open) {
        setResolvedPosition(position);
      }
      return;
    }

    const clampPosition = () => {
      const menuRect = menuRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - menuRect.width - VIEWPORT_PADDING;
      const maxY = window.innerHeight - menuRect.height - VIEWPORT_PADDING;

      setResolvedPosition({
        x: Math.max(VIEWPORT_PADDING, Math.min(position.x, maxX)),
        y: Math.max(VIEWPORT_PADDING, Math.min(position.y, maxY)),
      });
    };

    clampPosition();
    window.addEventListener("resize", clampPosition);

    return () => {
      window.removeEventListener("resize", clampPosition);
    };
  }, [items, open, position, title]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        top: resolvedPosition?.y ?? 0,
        left: resolvedPosition?.x ?? 0,
      }}
      role="menu"
    >
      {title ? <div className="context-menu__title">{title}</div> : null}
      {title ? <div className="context-menu__divider" /> : null}
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`context-menu__item ${item.danger ? "context-menu__item--danger" : ""}`}
          onClick={() => {
            if (item.disabled) {
              return;
            }
            item.onClick?.();
            onClose();
          }}
          role="menuitem"
          disabled={Boolean(item.disabled)}
        >
          {item.icon ? (
            <span className="context-menu__icon" aria-hidden="true">
              {item.icon}
            </span>
          ) : null}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export default ContextMenu;
