import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-4 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground">
            A aplicação encontrou um erro inesperado. Recarregue a página ou tente novamente.
          </p>
          {import.meta.env.DEV && (
            <pre className="text-xs bg-muted p-3 rounded text-left overflow-auto max-h-48 whitespace-pre-wrap">
              {this.state.error.message}
              {"\n"}
              {this.state.error.stack}
            </pre>
          )}
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={this.reset}>
              Tentar novamente
            </Button>
            <Button onClick={this.reload}>
              <RefreshCw className="h-4 w-4 mr-1" /> Recarregar
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
