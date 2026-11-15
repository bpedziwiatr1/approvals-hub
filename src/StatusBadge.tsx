import { Badge, type BadgeProps } from "@fluentui/react-components";
import {
  ArrowUndo16Regular,
  CalendarCancel16Regular,
  CheckmarkCircle16Regular,
  Clock16Regular,
  DismissCircle16Regular,
  Info16Regular,
  Prohibited16Regular,
} from "@fluentui/react-icons";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import type { ApprovalStatus } from "./data/dataClient";

const LOOK: Record<ApprovalStatus, { color: BadgeProps["color"]; icon: ReactElement }> = {
  pending: { color: "informative", icon: <Clock16Regular /> },
  approved: { color: "success", icon: <CheckmarkCircle16Regular /> },
  rejected: { color: "danger", icon: <DismissCircle16Regular /> },
  completed: { color: "brand", icon: <Info16Regular /> },
  cancelled: { color: "subtle", icon: <Prohibited16Regular /> },
  expired: { color: "warning", icon: <CalendarCancel16Regular /> },
  abandoned: { color: "important", icon: <ArrowUndo16Regular /> },
};

/** Display status as colour, icon and text together, so it never relies on colour alone. */
export function StatusBadge({ status, outcome }: { status: ApprovalStatus; outcome: string | null }) {
  const { t } = useTranslation();
  const { color, icon } = LOOK[status];
  return (
    <Badge data-status={status} appearance="tint" shape="rounded" color={color} icon={icon}>
      {status === "completed" && outcome ? outcome : t(`status.${status}`)}
    </Badge>
  );
}
