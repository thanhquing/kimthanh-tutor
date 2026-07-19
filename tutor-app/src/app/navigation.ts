import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CircleUserRound,
  ClipboardList,
  CreditCard,
  Landmark,
  LayoutDashboard,
  MessageSquareText,
  QrCode,
  Settings,
  WalletCards,
} from "lucide-react";

export interface NavigationItem {
  path: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  section: "work" | "account";
  mobile?: boolean;
}

export const navigation: NavigationItem[] = [
  { path: "/dashboard", label: "Dashboard", shortLabel: "Tổng quan", icon: LayoutDashboard, description: "Việc cần làm hôm nay", section: "work", mobile: true },
  { path: "/profile", label: "Hồ sơ gia sư", shortLabel: "Hồ sơ", icon: CircleUserRound, description: "Thông tin hiển thị trên chợ gia sư", section: "work", mobile: true },
  { path: "/availability", label: "Lịch rảnh", shortLabel: "Lịch", icon: CalendarDays, description: "Quản lý thời gian có thể nhận lớp", section: "work" },
  { path: "/trials", label: "Học thử", shortLabel: "Học thử", icon: ClipboardList, description: "Yêu cầu học thử đang chờ xử lý", section: "work" },
  { path: "/classes", label: "Lớp học", shortLabel: "Lớp", icon: BookOpen, description: "Các lớp đang phụ trách", section: "work", mobile: true },
  { path: "/lesson-logs", label: "Sổ đầu bài", shortLabel: "Sổ đầu bài", icon: WalletCards, description: "Nội dung và kết quả từng buổi học", section: "work" },
  { path: "/reviews", label: "Đánh giá lớp", shortLabel: "Đánh giá", icon: MessageSquareText, description: "Xem và phản hồi đánh giá của phụ huynh", section: "work" },
  { path: "/billing", label: "Gói QR", shortLabel: "Gói QR", icon: CreditCard, description: "Gói tính năng QR học phí", section: "account" },
  { path: "/payout-accounts", label: "Tài khoản nhận tiền", shortLabel: "Nhận tiền", icon: Landmark, description: "Tài khoản ngân hàng nhận học phí", section: "account" },
  { path: "/qr-records", label: "QR học phí", shortLabel: "QR", icon: QrCode, description: "QR và trạng thái tự đối soát", section: "account", mobile: true },
  { path: "/notifications", label: "Thông báo", shortLabel: "Thông báo", icon: Bell, description: "Cập nhật mới từ hệ thống", section: "account" },
  { path: "/settings", label: "Cài đặt", shortLabel: "Cài đặt", icon: Settings, description: "Thiết lập tài khoản và ứng dụng", section: "account" },
];

export function navigationFor(pathname: string): NavigationItem | undefined {
  return navigation.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
}
