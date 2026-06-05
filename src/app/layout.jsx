import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata = {
  title: "OneGrasp CEMS — Conference Email Management",
  description:
    "Enterprise email outreach & attendee management for OneGrasp Scientific Conferences.",
};

// This app is entirely client-data driven (Firebase). Skip static prerender.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
