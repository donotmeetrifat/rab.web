import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface via console for extension debugging; never crash silently.
    console.error("[Memlace] UI crash", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="min-h-dvh grid place-items-center bg-background text-foreground p-6">
        <div className="max-w-sm text-center space-y-3">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-sm font-semibold">Something went wrong.</h1>
          <p className="text-xs text-muted-foreground break-words">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:brightness-105 transition"
          >
            <RotateCw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      </div>
    );
  }
}
