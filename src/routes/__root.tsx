import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Button3D, LinkButton3D } from "../components/ui/button-3d";
import { Toaster } from "../components/ui/sonner";
import { AnalyticsTracker } from "../components/analytics-tracker";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <LinkButton3D to="/">Go home</LinkButton3D>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button3D
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button3D>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Bangladesh Railway Auto-Booker — Fast & Automated Train Ticket Booking" },
      {
        name: "description",
        content:
          "High-speed browser extension for Bangladesh Railway (eticket.railway.gov.bd). Automatically books train tickets during 8:00 AM rush hour with instant seat picking, coach selection, and fast checkout.",
      },
      {
        property: "og:title",
        content: "Bangladesh Railway Auto-Booker — Fast & Automated Train Ticket Booking",
      },
      {
        property: "og:description",
        content:
          "The fastest automated ticket booking extension for Bangladesh Railway. Auto seat picking, route selection, and millisecond 8:00 AM rush booking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.location.pathname.indexOf('/admin')===0)return;var v='';try{v=localStorage.getItem('rab_visitor_id')||'';if(!v){v='v_'+Math.random().toString(36).slice(2,10)+'_'+Date.now().toString(36);localStorage.setItem('rab_visitor_id',v);}}catch(e){v='v_p_'+Math.random().toString(36).slice(2,10);}var b=JSON.stringify({vid:v,path:window.location.pathname,ref:document.referrer||'',screen:(window.screen?window.screen.width+'x'+window.screen.height:'')});if(typeof fetch==='function'){fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:b,keepalive:true,cache:'no-store'}).catch(function(){});}window.__rab_tracked=true;}catch(e){}})();`,
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <AnalyticsTracker />
      <Toaster />
    </QueryClientProvider>
  );
}
