import { useState } from "react";
import { Share2 } from "lucide-react";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const PUBLISHED_URL = "https://idea411.lovable.app";

const emailSchema = z.string().trim().email().max(255);
const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^\+?[0-9\s\-().]+$/);

interface ShareAppButtonProps {
  className?: string;
}

export function ShareAppButton({ className }: ShareAppButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const subject = t("share.subject", { defaultValue: "Check out IdeaForge" });
  const body = t("share.body", {
    defaultValue: `I thought you'd like this: ${PUBLISHED_URL}`,
    url: PUBLISHED_URL,
  });

  const handleEmail = () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(t("share.invalidEmail", { defaultValue: "Enter a valid email address" }));
      return;
    }
    const href = `mailto:${encodeURIComponent(parsed.data)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setOpen(false);
    setEmail("");
  };

  const handleSms = () => {
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      toast.error(t("share.invalidPhone", { defaultValue: "Enter a valid phone number" }));
      return;
    }
    const href = `sms:${parsed.data.replace(/\s/g, "")}?body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setOpen(false);
    setPhone("");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PUBLISHED_URL);
      toast.success(t("share.copied", { defaultValue: "Link copied" }));
    } catch {
      toast.error(t("share.copyFailed", { defaultValue: "Couldn't copy link" }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={className}>
          <Share2 className="h-4 w-4" aria-hidden />
          <span>{t("share.button", { defaultValue: "Share" })}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("share.title", { defaultValue: "Share IdeaForge" })}</DialogTitle>
          <DialogDescription>
            {t("share.description", {
              defaultValue: "Send a link to a friend via email or text message.",
            })}
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="email" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email">{t("share.email", { defaultValue: "Email" })}</TabsTrigger>
            <TabsTrigger value="sms">{t("share.sms", { defaultValue: "Text" })}</TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="share-email">
                {t("share.emailLabel", { defaultValue: "Recipient email" })}
              </Label>
              <Input
                id="share-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={255}
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={handleCopy}>
                {t("share.copyLink", { defaultValue: "Copy link" })}
              </Button>
              <Button type="button" onClick={handleEmail}>
                {t("share.sendEmail", { defaultValue: "Send email" })}
              </Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="sms" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="share-phone">
                {t("share.phoneLabel", { defaultValue: "Recipient phone" })}
              </Label>
              <Input
                id="share-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                placeholder="+1 555 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={handleCopy}>
                {t("share.copyLink", { defaultValue: "Copy link" })}
              </Button>
              <Button type="button" onClick={handleSms}>
                {t("share.sendSms", { defaultValue: "Send text" })}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
