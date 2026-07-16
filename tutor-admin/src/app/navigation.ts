import type { LucideIcon } from "lucide-react";
import { BadgeDollarSign, ClipboardCheck, LayoutDashboard, ReceiptText, ScrollText, Settings, Users } from "lucide-react";

export interface NavigationItem { path: string; label: string; shortLabel: string; icon: LucideIcon; description: string; section: "operations" | "system"; mobile?: boolean; task: string; }

export const navigation: NavigationItem[] = [
  { path: "/overview", label: "Tổng quan", shortLabel: "Tổng quan", icon: LayoutDashboard, description: "Tình hình vận hành nền tảng", section: "operations", mobile: true, task: "AD-01" },
  { path: "/users", label: "Người dùng", shortLabel: "Người dùng", icon: Users, description: "Tra cứu và quản lý trạng thái tài khoản", section: "operations", mobile: true, task: "AD-02" },
  { path: "/moderation", label: "Kiểm duyệt", shortLabel: "Duyệt", icon: ClipboardCheck, description: "Hồ sơ, media và đánh giá", section: "operations", mobile: true, task: "AD-04" },
  { path: "/payments", label: "Thanh toán", shortLabel: "Thanh toán", icon: ReceiptText, description: "Giao dịch sản phẩm nền tảng và hoàn tiền", section: "operations", mobile: true, task: "AD-05" },
  { path: "/logs", label: "Nhật ký", shortLabel: "Nhật ký", icon: ScrollText, description: "Audit, webhook và outbox đã redaction", section: "system", mobile: true, task: "AD-06" },
  { path: "/platform", label: "Nền tảng & giá", shortLabel: "Cấu hình", icon: BadgeDollarSign, description: "VietQR nền tảng và bảng giá sản phẩm", section: "system", task: "AD-07" },
  { path: "/settings", label: "Phiên & bảo mật", shortLabel: "Bảo mật", icon: Settings, description: "Thông tin phiên và metadata bản dựng", section: "system", task: "AD-09" },
];

export function navigationFor(pathname: string) { return navigation.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`)); }
