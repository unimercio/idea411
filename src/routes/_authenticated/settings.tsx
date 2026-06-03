import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Flame, Save, Upload, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getMySettings, updateMySettings } from "@/lib/api/settings.functions";
import { SUPPORTED_LANGUAGES, applyLanguage } from "@/i18n";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — IdeaForge" },
      { name: "description", content: "Manage your account preferences." },
    ],
  }),
  component: SettingsPage,
});

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

function SettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMySettings);
  const updateFn = useServerFn(updateMySettings);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-settings"],
    queryFn: () => getFn(),
  });

  const [firstName, setFirstName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) {
      setFirstName(data.first_name ?? "");
      setTitle(data.title ?? "");
      setCompany(data.company ?? "");
      setWebsite(data.website ?? "");
      setAvatarPath(data.avatar_url ?? "");
    }
  }, [data]);

  // Generate signed URL for private avatar bucket
  useEffect(() => {
    let cancelled = false;
    if (!avatarPath) {
      setAvatarPreview(null);
      return;
    }
    (async () => {
      const { data: signed, error: e } = await supabase.storage
        .from("avatars")
        .createSignedUrl(avatarPath, 3600);
      if (!cancelled && !e) setAvatarPreview(signed.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [avatarPath]);

  const mutation = useMutation({
    mutationFn: (vars: {
      first_name: string;
      title: string;
      company: string;
      website: string;
      avatar_url: string;
    }) => updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Settings saved.");
      qc.invalidateQueries({ queryKey: ["my-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image must be 2MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${userData.user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // Best-effort cleanup of prior avatar
      if (avatarPath && avatarPath !== path) {
        await supabase.storage.from("avatars").remove([avatarPath]);
      }
      setAvatarPath(path);
      toast.success("Avatar uploaded. Don't forget to save.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!avatarPath) return;
    try {
      await supabase.storage.from("avatars").remove([avatarPath]);
    } catch {
      // ignore — still clear locally
    }
    setAvatarPath("");
    toast.success("Avatar removed. Don't forget to save.");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (website && website.length > 0) {
      try {
        // eslint-disable-next-line no-new
        new URL(website);
      } catch {
        toast.error("Website must be a valid URL (e.g., https://example.com).");
        return;
      }
    }
    mutation.mutate({
      first_name: firstName.trim(),
      title: title.trim(),
      company: company.trim(),
      website: website.trim(),
      avatar_url: avatarPath,
    });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
              <Flame className="h-4 w-4" />
            </span>
            IdeaForge
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to projects
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personal details used across your IdeaForge experience.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
          <h2 className="font-display text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Tell us a bit about yourself.
          </p>

          {error && (
            <p className="mb-4 text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load settings"}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 rounded-full overflow-hidden border border-border bg-muted grid place-items-center">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || mutation.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Uploading…" : avatarPath ? "Change avatar" : "Upload avatar"}
                  </Button>
                  {avatarPath && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAvatar}
                      disabled={uploading || mutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG, or GIF. Max 2MB.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="first_name">First name</Label>
                <Input
                  id="first_name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ada"
                  maxLength={100}
                  disabled={isLoading || mutation.isPending}
                  autoComplete="given-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Founder, Product Manager…"
                  maxLength={150}
                  disabled={isLoading || mutation.isPending}
                  autoComplete="organization-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Inc."
                  maxLength={150}
                  disabled={isLoading || mutation.isPending}
                  autoComplete="organization"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                  maxLength={255}
                  disabled={isLoading || mutation.isPending}
                  autoComplete="url"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="submit"
                disabled={isLoading || mutation.isPending || uploading}
                className="bg-gradient-ember text-ember-foreground shadow-ember hover:brightness-110"
              >
                <Save className="h-4 w-4 mr-2" />
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
