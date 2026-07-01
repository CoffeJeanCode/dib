declare module "@radix-ui/react-context-menu" {
  import * as React from "react";

  export interface ContextMenuProps {
    children?: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
    modal?: boolean;
  }

  export interface ContextMenuTriggerProps {
    children?: React.ReactNode;
    asChild?: boolean;
    disabled?: boolean;
  }

  export interface ContextMenuContentProps {
    children?: React.ReactNode;
    className?: string;
    align?: "start" | "center" | "end";
    sideOffset?: number;
    alignOffset?: number;
    onCloseAutoFocus?: (event: Event) => void;
    onEscapeKeyDown?: (event: KeyboardEvent) => void;
    onPointerDownOutside?: (event: PointerDownOutsideEvent) => void;
    onInteractOutside?: (event: Event) => void;
    loop?: boolean;
    portalled?: boolean;
    onFocusOutside?: (event: FocusEvent) => void;
  }

  export interface ContextMenuItemProps {
    children?: React.ReactNode;
    className?: string;
    onSelect?: (event: Event) => void;
    disabled?: boolean;
    textValue?: string;
    inset?: boolean;
  }

  export interface ContextMenuSeparatorProps {
    className?: string;
  }

  export interface ContextMenuLabelProps {
    children?: React.ReactNode;
    className?: string;
    inset?: boolean;
  }

  export interface ContextMenuSubProps {
    children?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }

  export interface ContextMenuSubTriggerProps {
    children?: React.ReactNode;
    className?: string;
    disabled?: boolean;
    inset?: boolean;
  }

  export interface ContextMenuSubContentProps {
    children?: React.ReactNode;
    className?: string;
    sideOffset?: number;
    alignOffset?: number;
  }

  export interface PointerDownOutsideEvent extends CustomEvent {
    detail: { originalEvent: PointerEvent };
  }

  export const Root: React.FC<ContextMenuProps>;
  export const Trigger: React.FC<ContextMenuTriggerProps>;
  export const Content: React.FC<ContextMenuContentProps>;
  export const Item: React.FC<ContextMenuItemProps>;
  export const Separator: React.FC<ContextMenuSeparatorProps>;
  export const Label: React.FC<ContextMenuLabelProps>;
  export const Sub: React.FC<ContextMenuSubProps>;
  export const SubTrigger: React.FC<ContextMenuSubTriggerProps>;
  export const SubContent: React.FC<ContextMenuSubContentProps>;
  export const Portal: React.FC<{ children?: React.ReactNode }>;
}
