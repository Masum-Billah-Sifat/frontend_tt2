"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, ConversationItem, FeedItem } from "@/lib/auth";
export default function GuardianPage() {
  const {
    user,
    loading,
    accessToken,
    api,
    addRole,
    switchRole,
    logout,
    lastRealtimeMessage,
    clearLastRealtimeMessage,
  } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("Dhaka");
  const router = useRouter();
  const load = async () => {
    if (!accessToken) return;
    setFeed(
      (await api<{ items: FeedItem[] }>("/api/feed/tutors", {}, accessToken))
        .items,
    );
    setConversations(
      (
        await api<{ items: ConversationItem[] }>(
          "/api/conversations",
          {},
          accessToken,
        )
      ).items,
    );
  };
  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "guardian"))
      router.replace(user?.activeRole === "tutor" ? "/tutor" : "/");
  }, [loading, user, router]);
  useEffect(() => {
    void load();
  }, [accessToken]);
  useEffect(() => {
    if (lastRealtimeMessage) {
      void load();
      clearLastRealtimeMessage();
    }
  }, [lastRealtimeMessage, clearLastRealtimeMessage]);
  if (loading || !user)
    return (
      <main className="container">
        <div className="card">Loading...</div>
      </main>
    );
  const start = async (otherUserId: string) => {
    const data = await api<{ conversationId: string }>(
      "/api/conversations/direct",
      { method: "POST", body: JSON.stringify({ otherUserId }) },
      accessToken,
    );
    router.push(`/messages/${data.conversationId}`);
  };
  return (
    <main className="container grid">
      <div className="row">
        <div>
          <h1>Guardian dashboard</h1>
          <p className="small">
            Welcome {user.guardianProfile?.displayName || user.email}
          </p>
        </div>
        <div className="row">
          {user.roles.includes("tutor") ? (
            <button
              className="btn secondary"
              onClick={() => switchRole("tutor")}
            >
              Switch to tutor
            </button>
          ) : (
            <button
              className="btn secondary"
              onClick={() => setShowAdd((v) => !v)}
            >
              Become tutor too
            </button>
          )}
          <button className="btn secondary" onClick={() => logout()}>
            Logout
          </button>
        </div>
      </div>
      {showAdd ? (
        <form
          className="card grid"
          onSubmit={async (e) => {
            e.preventDefault();
            await addRole("tutor", {
              displayName: name,
              primaryLocation: location,
            });
          }}
        >
          <h2>Add tutor role</h2>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tutor display name"
            required
          />
          <input
            className="input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Primary location"
            required
          />
          <button className="btn primary">Create tutor role</button>
        </form>
      ) : null}
      <div className="grid2">
        <section className="card">
          <h2>Mock tutor feed</h2>
          <div className="grid">
            {feed.map((item) => (
              <div key={item.userId} className="row">
                <div>
                  <strong>{item.displayName}</strong>
                  <div className="small">{item.primaryLocation}</div>
                  <span className={`badge ${item.isOnline ? "online" : ""}`}>
                    {item.isOnline
                      ? "Online"
                      : item.lastSeenAt
                        ? `Last seen ${new Date(item.lastSeenAt).toLocaleString()}`
                        : "Offline"}
                  </span>
                </div>
                <button
                  className="btn primary"
                  onClick={() => start(item.userId)}
                >
                  Send message
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>Inbox</h2>
          <div className="grid">
            {conversations.map((item) => (
              <div key={item.conversationId} className="row">
                <div>
                  <strong>{item.otherDisplayName || "Unknown user"}</strong>
                  <div className="small">
                    {item.lastMessagePreview || "No messages yet"}
                  </div>
                  <div className="small">Unread: {item.unreadCount}</div>
                </div>
                <button
                  className="btn secondary"
                  onClick={() =>
                    router.push(`/messages/${item.conversationId}`)
                  }
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
