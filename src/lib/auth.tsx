"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

export type Role = "guardian" | "tutor";
export type UserState = {
  id: string;
  email: string;
  activeRole: Role | null;
  onboardingCompleted: boolean;
  lastSeenAt: string | null;
  roles: Role[];
  guardianProfile: {
    displayName: string;
    profileImageUrl: string | null;
    primaryLocation: string;
  } | null;
  tutorProfile: {
    displayName: string;
    profileImageUrl: string | null;
    primaryLocation: string;
    profileCompleted: boolean;
  } | null;
};
export type ConversationItem = {
  conversationId: string;
  otherUserId: string;
  otherDisplayName: string | null;
  otherProfileImageUrl: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  isOnline: boolean;
  lastSeenAt: string | null;
};
export type FeedItem = {
  userId: string;
  displayName: string;
  profileImageUrl: string | null;
  primaryLocation: string;
  profileCompleted?: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
};
export type MessageItem = {
  id: string;
  conversationId?: string;
  senderUserId: string;
  type: "text" | "audio";
  textContent: string | null;
  audioUrl: string | null;
  parentMessageId: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
let socketRef: any = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
async function api<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(data.error || "Request failed");
  }
  return res.json();
}
async function upload(uploadUrl: string, file: Blob, contentType: string) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) throw new Error("Upload failed");
}

const AuthContext = createContext<any>(null);
const nextRoute = (user: UserState | null) =>
  !user
    ? "/"
    : !user.roles.length || !user.activeRole || !user.onboardingCompleted
      ? "/onboarding"
      : user.activeRole === "guardian"
        ? "/guardian"
        : "/tutor";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserState | null>(null);
  const [lastRealtimeMessage, setLastRealtimeMessage] =
    useState<MessageItem | null>(null);

  const connectSocket = useCallback(async (token: string) => {
    if (typeof window === "undefined") return;
    const { io } = await import("socket.io-client");
    if (socketRef) {
      socketRef.auth = { token };
      if (!socketRef.connected) socketRef.connect();
      return;
    }
    socketRef = io(API, {
      transports: ["websocket"],
      withCredentials: true,
      auth: { token },
    });
    socketRef.on("chat:new_message", (message: MessageItem) =>
      setLastRealtimeMessage(message),
    );
    socketRef.on("connect", () => {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = setInterval(() => socketRef?.emit("presence:ping"), 30000);
    });
    socketRef.on("disconnect", () => {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
    });
  }, []);

  useEffect(() => {
    api<{ accessToken: string; user: UserState }>("/api/auth/refresh", {
      method: "POST",
    })
      .then((data) => {
        setAccessToken(data.accessToken);
        setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (accessToken) void connectSocket(accessToken);
    else {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      socketRef?.disconnect();
      socketRef = null;
    }
  }, [accessToken, connectSocket]);

  const value = useMemo(
    () => ({
      accessToken,
      user,
      loading,
      lastRealtimeMessage,
      clearLastRealtimeMessage: () => setLastRealtimeMessage(null),
      api,
      upload,
      loginWithGoogle: async (idToken: string) => {
        const data = await api<{ accessToken: string; user: UserState }>(
          "/api/auth/google",
          { method: "POST", body: JSON.stringify({ idToken }) },
        );
        setAccessToken(data.accessToken);
        setUser(data.user);
        router.push(nextRoute(data.user));
      },
      logout: async () => {
        if (accessToken)
          await api("/api/auth/logout", { method: "POST" }, accessToken).catch(
            () => {},
          );
        setAccessToken(null);
        setUser(null);
        router.push("/");
      },
      switchRole: async (role: Role) => {
        await api(
          "/api/roles/switch",
          { method: "POST", body: JSON.stringify({ activeRole: role }) },
          accessToken,
        );
        const me = await api<{ user: UserState }>(
          "/api/auth/me",
          {},
          accessToken,
        );
        setUser(me.user);
        router.push(role === "guardian" ? "/guardian" : "/tutor");
      },
      selectInitialRole: async (role: Role, payload: any) => {
        await api(
          "/api/roles/select-initial",
          { method: "POST", body: JSON.stringify({ role, ...payload }) },
          accessToken,
        );
        const me = await api<{ user: UserState }>(
          "/api/auth/me",
          {},
          accessToken,
        );
        setUser(me.user);
        router.push(nextRoute(me.user));
      },
      addRole: async (role: Role, payload: any) => {
        await api(
          `/api/roles/${role === "guardian" ? "add-guardian" : "add-tutor"}`,
          { method: "POST", body: JSON.stringify(payload) },
          accessToken,
        );
        const me = await api<{ user: UserState }>(
          "/api/auth/me",
          {},
          accessToken,
        );
        setUser(me.user);
        router.push(role === "guardian" ? "/guardian" : "/tutor");
      },
      setUser,
    }),
    [accessToken, user, loading, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("Missing AuthProvider");
  return ctx;
}
