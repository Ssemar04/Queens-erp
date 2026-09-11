import { useState } from "react";
import { Copy, Check, KeyRound, Mail, User, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EmployeeOneTimeCredentials } from "@/services/api";

interface OneTimeCredentialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  credentials: EmployeeOneTimeCredentials | null;
}

export function OneTimeCredentialsModal({
  open,
  onOpenChange,
  employeeName,
  credentials,
}: OneTimeCredentialsModalProps) {
  const [copied, setCopied] = useState(false);

  if (!credentials) return null;

  const handleCopy = () => {
    const textToCopy = `System Login Credentials for ${employeeName}:
Email: ${credentials.email}
One-Time Password: ${credentials.oneTimePassword}

Please log in and change your password in Account Settings.`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("One-time credentials copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-border shadow-2xl">
        {/* Header */}
        <div className="border-b border-border/80 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-background p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 shadow-sm">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-semibold text-foreground">
                  Credentials Generated
                </DialogTitle>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-[10px]">
                  One-Time Pass
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Temporary login details for <span className="font-medium text-foreground">{employeeName}</span>
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-border bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <User className="h-3.5 w-3.5 text-primary" />
                Employee Account:
              </span>
              <span className="font-semibold text-foreground">{employeeName}</span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> Login Email / Username
              </span>
              <div className="rounded-lg border bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono font-medium text-foreground select-all">
                {credentials.email}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <KeyRound className="h-3 w-3 text-amber-500" /> One-Time Password
              </span>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-base font-mono font-bold tracking-wider text-amber-700 dark:text-amber-400 select-all flex items-center justify-between">
                <span>{credentials.oneTimePassword}</span>
                <Badge className="bg-amber-600 text-white text-[10px] uppercase font-sans font-medium">
                  Temporary
                </Badge>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-50/60 dark:bg-blue-950/20 p-3.5 text-xs space-y-1 text-blue-900 dark:text-blue-200">
            <div className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
              <span>Next Steps for Employee:</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed pl-5">
              Share these credentials with the employee. Upon signing in, they will be prompted to update their password in Account Settings.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Done
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Credentials
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
