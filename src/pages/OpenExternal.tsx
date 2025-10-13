import { useEffect, useMemo } from "react";
import { useLocation, Link } from "react-router-dom";

// Minimal page that safely redirects to allowed external URLs
// This is used to work around iframe/browser restrictions in preview environments.
const OpenExternal = () => {
  const location = useLocation();

  const target = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const to = params.get("to") || "";
    try {
      const url = new URL(to);
      const host = url.hostname.toLowerCase();
      const allowed = host.includes("youtube.com") || host.includes("youtu.be");
      if (!allowed) return "";
      if (url.protocol !== "https:") return "";
      return url.toString();
    } catch {
      return "";
    }
  }, [location.search]);

  useEffect(() => {
    if (target) {
      // Replace so the intermediate page isn't in the history
      window.location.replace(target);
    }
  }, [target]);

  if (!target) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">Unable to open link</h1>
          <p className="text-muted-foreground max-w-md">
            The link is invalid or from an unsupported domain. Only YouTube links are allowed.
          </p>
          <Link to="/setlist" className="text-primary underline">
            Go back to setlists
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="space-y-4">
        <h1 className="text-xl font-medium">Opening link…</h1>
        <a
          href={target}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          Click here if you are not redirected
        </a>
      </div>
    </main>
  );
};

export default OpenExternal;
