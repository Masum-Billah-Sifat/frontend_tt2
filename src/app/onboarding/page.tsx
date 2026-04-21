"use client";
import { FormEvent, useState } from "react";
import { useAuth, Role } from "@/lib/auth";
export default function OnboardingPage() {
  const { user, loading, accessToken, api, upload, selectInitialRole } =
    useAuth();
  const [role, setRole] = useState<Role>("guardian");
  const [displayName, setDisplayName] = useState("");
  const [primaryLocation, setPrimaryLocation] = useState("Dhaka");
  const [profileImageKey, setProfileImageKey] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (loading)
    return (
      <main className="container">
        <div className="card">Loading...</div>
      </main>
    );
  if (!user)
    return (
      <main className="container">
        <div className="card">Please log in first.</div>
      </main>
    );
  async function onFile(file: File) {
    const ext = file.name.split(".").pop() || "jpg";
    const presign = await api<{
      uploadUrl: string;
      objectKey: string;
      fileUrl: string;
    }>(
      "/api/uploads/presign",
      {
        method: "POST",
        body: JSON.stringify({
          fileCategory: "profile_image",
          contentType: file.type || "image/jpeg",
          extension: ext,
        }),
      },
      accessToken,
    );
    await upload(presign.uploadUrl, file, file.type || "image/jpeg");
    setProfileImageKey(presign.objectKey);
    setProfileImageUrl(presign.fileUrl);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await selectInitialRole(role, {
        displayName,
        primaryLocation,
        profileImageKey,
        profileImageUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }
  return (
    <main className="container">
      <form className="card grid" onSubmit={submit}>
        <h1>Choose your first role</h1>
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <label>
            <input
              type="radio"
              checked={role === "guardian"}
              onChange={() => setRole("guardian")}
            />{" "}
            Hire tutor
          </label>
          <label>
            <input
              type="radio"
              checked={role === "tutor"}
              onChange={() => setRole("tutor")}
            />{" "}
            Become tutor
          </label>
        </div>
        <input
          className="input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name"
          required
        />
        <input
          className="input"
          value={primaryLocation}
          onChange={(e) => setPrimaryLocation(e.target.value)}
          placeholder="Primary location"
          required
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        {profileImageUrl ? (
          <img
            src={profileImageUrl}
            alt="profile"
            width={64}
            height={64}
            style={{ borderRadius: 999 }}
          />
        ) : null}
        {error ? <p className="small">{error}</p> : null}
        <button className="btn primary" type="submit">
          Continue
        </button>
      </form>
    </main>
  );
}
