import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false } };
/** Không SSR dữ liệu riêng tư: các task sau hydrate client sau auth + consent guard. */
export default function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
