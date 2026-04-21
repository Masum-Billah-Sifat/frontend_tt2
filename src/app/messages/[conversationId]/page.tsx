"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MessageItem, useAuth } from "@/lib/auth";
export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const {
    user,
    loading,
    accessToken,
    api,
    upload,
    lastRealtimeMessage,
    clearLastRealtimeMessage,
  } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [sendingAudio, setSendingAudio] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const load = async (nextCursor?: string | null) => {
    const data = await api<{ items: MessageItem[]; nextCursor: string | null }>(
      `/api/conversations/${conversationId}/messages${nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : ""}`,
      {},
      accessToken,
    );
    setMessages((prev) => (nextCursor ? [...data.items, ...prev] : data.items));
    setCursor(data.nextCursor);
  };
  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);
  useEffect(() => {
    if (accessToken) {
      void load();
      void api(
        `/api/conversations/${conversationId}/read`,
        { method: "POST" },
        accessToken,
      );
    }
  }, [accessToken, conversationId]);
  useEffect(() => {
    if (lastRealtimeMessage?.conversationId === conversationId) {
      setMessages((prev) =>
        prev.some((m) => m.id === lastRealtimeMessage.id)
          ? prev
          : [...prev, lastRealtimeMessage],
      );
      clearLastRealtimeMessage();
      void api(
        `/api/conversations/${conversationId}/read`,
        { method: "POST" },
        accessToken,
      );
    }
  }, [
    lastRealtimeMessage,
    conversationId,
    clearLastRealtimeMessage,
    accessToken,
    api,
  ]);
  async function sendText() {
    if (!text.trim()) return;
    const data = await api<{ message: MessageItem }>(
      "/api/messages",
      {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          type: "text",
          textContent: text,
          parentMessageId: replyTo,
        }),
      },
      accessToken,
    );
    setMessages((prev) => [...prev, data.message]);
    setText("");
    setReplyTo(null);
  }
  async function sendAudio(blob: Blob) {
    setSendingAudio(true);
    const presign = await api<{
      uploadUrl: string;
      objectKey: string;
      fileUrl: string;
    }>(
      "/api/uploads/presign",
      {
        method: "POST",
        body: JSON.stringify({
          fileCategory: "audio_message",
          contentType: blob.type || "audio/webm",
          extension: "webm",
        }),
      },
      accessToken,
    );
    await upload(presign.uploadUrl, blob, blob.type || "audio/webm");
    const data = await api<{ message: MessageItem }>(
      "/api/messages",
      {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          type: "audio",
          audioObjectKey: presign.objectKey,
          audioUrl: presign.fileUrl,
          parentMessageId: replyTo,
        }),
      },
      accessToken,
    );
    setMessages((prev) => [...prev, data.message]);
    setReplyTo(null);
    setSendingAudio(false);
  }
  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      await sendAudio(
        new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        }),
      );
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }
  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }
  async function editMessage(id: string) {
    const next = window.prompt("Edit message");
    if (!next?.trim()) return;
    await api(
      `/api/messages/${id}`,
      { method: "PATCH", body: JSON.stringify({ textContent: next }) },
      accessToken,
    );
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, textContent: next, isEdited: true } : m,
      ),
    );
  }
  async function deleteMessage(id: string) {
    await api(`/api/messages/${id}`, { method: "DELETE" }, accessToken);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, isDeleted: true, textContent: "This message was deleted" }
          : m,
      ),
    );
  }
  if (loading || !user)
    return (
      <main className="container">
        <div className="card">Loading...</div>
      </main>
    );
  return (
    <main className="container grid">
      <div className="row">
        <button
          className="btn secondary"
          onClick={() =>
            router.push(user.activeRole === "guardian" ? "/guardian" : "/tutor")
          }
        >
          Back
        </button>
        <div className="small">Live conversation • unread reset on open</div>
      </div>
      <div className="card grid">
        {cursor ? (
          <button className="btn secondary" onClick={() => load(cursor)}>
            Load older
          </button>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.senderUserId === user.id ? "mine" : ""} ${message.isDeleted ? "deleted" : ""}`}
          >
            {message.parentMessageId ? (
              <div className="small">
                Replying to {message.parentMessageId.slice(0, 8)}
              </div>
            ) : null}
            {message.type === "text" ? (
              <div>
                {message.isDeleted
                  ? "This message was deleted"
                  : message.textContent}
              </div>
            ) : null}
            {message.type === "audio" && !message.isDeleted ? (
              <audio controls src={message.audioUrl || undefined} />
            ) : null}
            <div className="small">
              {new Date(message.createdAt).toLocaleString()}{" "}
              {message.isEdited ? "• edited" : ""}
            </div>
            {message.senderUserId === user.id && !message.isDeleted ? (
              <div
                className="row"
                style={{ justifyContent: "flex-start", marginTop: 8 }}
              >
                {message.type === "text" ? (
                  <button
                    className="btn secondary"
                    onClick={() => editMessage(message.id)}
                  >
                    Edit
                  </button>
                ) : null}
                <button
                  className="btn danger"
                  onClick={() => deleteMessage(message.id)}
                >
                  Delete
                </button>
              </div>
            ) : null}
            {!message.isDeleted ? (
              <button
                className="btn secondary"
                style={{ marginTop: 8 }}
                onClick={() => setReplyTo(message.id)}
              >
                Reply
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <div className="card grid">
        {replyTo ? (
          <div className="row">
            <div className="small">Replying to {replyTo.slice(0, 8)}</div>
            <button className="btn secondary" onClick={() => setReplyTo(null)}>
              Cancel reply
            </button>
          </div>
        ) : null}
        <textarea
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a text message"
        />
        <div className="row">
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <button className="btn primary" onClick={() => sendText()}>
              Send text
            </button>
            {!recording ? (
              <button
                className="btn secondary"
                onClick={() => startRecording()}
              >
                Record audio
              </button>
            ) : (
              <button className="btn danger" onClick={() => stopRecording()}>
                Stop recording
              </button>
            )}
          </div>
          <div className="small">
            {sendingAudio
              ? "Uploading audio..."
              : recording
                ? "Recording..."
                : "Idle"}
          </div>
        </div>
      </div>
    </main>
  );
}
