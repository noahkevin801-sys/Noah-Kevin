import 'dotenv/config';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import type {
  OnlinePlayerProfile,
  PublicChatRoom,
  ServerWsEvent,
  SharedChatMessage,
  SharedComment,
  SharedSocialPost,
  SocialPlatform,
  WorldSnapshot,
} from './src/types/network';
import type { GenreId } from './src/types/game';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const WORLD_FILE = path.join(DATA_DIR, 'world-state.json');

const PUBLIC_ROOMS: PublicChatRoom[] = [
  {
    id: 'room_global',
    name: 'Salon Général Artistes',
    description: 'Discute en direct avec tous les vrais joueurs connectés.',
    badge: 'Live',
  },
  {
    id: 'room_collab',
    name: 'Featurings & Studio',
    description: 'Trouve un autre joueur pour collaborer sur un titre ou un clip.',
    badge: 'Collab',
  },
  {
    id: 'room_promo',
    name: 'Club Promo & Charts',
    description: 'Partage tes sorties Alltify, AllTok et grimpe dans le Top 200.',
    badge: 'Charts',
  },
];

const SEED_POSTS: SharedSocialPost[] = [
  {
    id: 'seed_post_allgram_1',
    platform: 'allgram',
    authorId: 'npc_kaelen',
    authorName: 'Kaelen',
    authorHandle: '@kaelen_93',
    authorAvatar: '/src/assets/images/artist_portrait_urban_1795252245054.jpg',
    verified: true,
    isPlayer: false,
    location: 'Studio Grande Armée · Paris',
    tag: 'Studio',
    content: 'En session nocturne. « Chronographe » dépasse les 120k écoutes cette semaine sur Alltify.',
    mediaTone: 'from-violet-600/80 via-indigo-700/80 to-slate-900',
    attachedSongTitle: 'Chronographe',
    likes: 18420,
    likedByIds: [],
    reposts: 2150,
    repostedByIds: [],
    views: 94200,
    comments: [
      {
        id: 'seed_c1',
        authorId: 'npc_naya',
        authorName: 'Naya',
        authorHandle: '@nayamusic',
        text: 'Le mix sur le deuxième couplet est irréel.',
        createdAt: Date.now() - 3600_000,
      },
    ],
    createdAt: Date.now() - 7200_000,
  },
  {
    id: 'seed_post_alltok_1',
    platform: 'alltok',
    authorId: 'npc_naya',
    authorName: 'Naya',
    authorHandle: '@nayamusic',
    authorAvatar: '/src/assets/images/artist_portrait_pop_1795252244416.jpg',
    verified: true,
    isPlayer: false,
    tag: 'AllTok Challenge',
    content: '15 secondes a cappella de « Diamant Brut » avant le clip officiel sur AllTub.',
    mediaTone: 'from-amber-500/80 via-rose-600/80 to-slate-900',
    attachedSongTitle: 'Diamant Brut',
    likes: 34200,
    likedByIds: [],
    reposts: 4820,
    repostedByIds: [],
    views: 412000,
    comments: [],
    createdAt: Date.now() - 5400_000,
  },
  {
    id: 'seed_post_allx_1',
    platform: 'allx',
    authorId: 'npc_soren',
    authorName: 'Soren',
    authorHandle: '@soren_officiel',
    authorAvatar: '/src/assets/images/artist_portrait_electro_1795252245354.jpg',
    verified: true,
    isPlayer: false,
    tag: '#AllStarzCharts',
    content: 'Qui sort un Album ou une Édition Deluxe ce vendredi ? Le Top 50 Global bouge tellement vite cette semaine.',
    mediaTone: 'from-sky-500/80 via-cyan-700/80 to-slate-900',
    likes: 8930,
    likedByIds: [],
    reposts: 1410,
    repostedByIds: [],
    views: 158000,
    comments: [],
    createdAt: Date.now() - 4000_000,
  },
  {
    id: 'seed_post_alltub_1',
    platform: 'alltub',
    authorId: 'npc_kaelen',
    authorName: 'Kaelen',
    authorHandle: '@kaelen_93',
    authorAvatar: '/src/assets/images/artist_portrait_urban_1795252245054.jpg',
    verified: true,
    isPlayer: false,
    tag: 'Clip Officiel',
    title: 'Kaelen — Chronographe (Clip Officiel 4K)',
    content: 'Réalisé de nuit entre Paris et Tokyo. Merci pour la force sur AllTub.',
    mediaTone: 'from-rose-700/80 via-slate-900 to-black',
    attachedSongTitle: 'Chronographe',
    videoDuration: '03:42',
    likes: 142000,
    likedByIds: [],
    reposts: 9200,
    repostedByIds: [],
    views: 1840000,
    comments: [],
    createdAt: Date.now() - 8000_000,
  },
  {
    id: 'seed_post_allcloud_1',
    platform: 'allcloud',
    authorId: 'npc_milo',
    authorName: 'Milo Vance',
    authorHandle: '@milovance',
    authorAvatar: '/src/assets/images/artist_portrait_electro_1795252245354.jpg',
    verified: true,
    isPlayer: false,
    tag: 'Demo Brute',
    title: 'Berlin 03h (Maquette Synthé Analogique)',
    content: 'Premier jet enregistré en direct avant le mastering.',
    mediaTone: 'from-emerald-500/80 via-teal-700/80 to-slate-900',
    attachedSongTitle: 'Berlin 03h',
    videoDuration: '02:51',
    likes: 4120,
    likedByIds: [],
    reposts: 620,
    repostedByIds: [],
    views: 38500,
    comments: [],
    createdAt: Date.now() - 6200_000,
  },
];

const SEED_CHAT_MESSAGES: SharedChatMessage[] = [
  {
    id: 'seed_msg_1',
    roomId: 'room_global',
    senderId: 'npc_claire',
    senderName: 'Claire Delacroix',
    senderHandle: '@claire_mgmt',
    senderAvatar: '/src/assets/images/artist_portrait_pop_1795252244416.jpg',
    isAi: true,
    text: 'Bienvenue dans le salon en direct d’ALL STARZ ! Tous les vrais joueurs connectés peuvent discuter ici et publier sur AllGram, AllTok, AllX et AllTub.',
    createdAt: Date.now() - 1800_000,
  },
];

interface PersistedWorld {
  players: Record<string, OnlinePlayerProfile>;
  posts: SharedSocialPost[];
  chatMessages: SharedChatMessage[];
}

function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLen);
}

function sanitizeAvatarUrl(input: unknown): string {
  if (typeof input !== 'string') return '/src/assets/images/artist_portrait_pop_1795252244416.jpg';
  const trimmed = input.trim();
  if (trimmed.startsWith('/src/assets/images/') || trimmed.startsWith('/assets/')) {
    return trimmed;
  }
  return '/src/assets/images/artist_portrait_pop_1795252244416.jpg';
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadWorldState(): PersistedWorld {
  ensureDataDir();
  try {
    if (fs.existsSync(WORLD_FILE)) {
      const raw = fs.readFileSync(WORLD_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedWorld>;
      return {
        players: parsed.players && typeof parsed.players === 'object' ? parsed.players : {},
        posts: Array.isArray(parsed.posts) && parsed.posts.length > 0 ? parsed.posts : [...SEED_POSTS],
        chatMessages: Array.isArray(parsed.chatMessages) && parsed.chatMessages.length > 0
          ? parsed.chatMessages
          : [...SEED_CHAT_MESSAGES],
      };
    }
  } catch (err) {
    console.warn('World state load fallback to seed:', err);
  }
  return {
    players: {},
    posts: [...SEED_POSTS],
    chatMessages: [...SEED_CHAT_MESSAGES],
  };
}

let worldState: PersistedWorld = loadWorldState();
let saveTimeout: NodeJS.Timeout | null = null;

function schedulePersistWorld() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      ensureDataDir();
      const tmpPath = path.join(DATA_DIR, `world-state.${Date.now()}.tmp`);
      fs.writeFileSync(tmpPath, JSON.stringify(worldState, null, 2), 'utf8');
      fs.renameSync(tmpPath, WORLD_FILE);
    } catch (err) {
      console.error('Failed to persist world state:', err);
    }
  }, 250);
}

function getWorldSnapshot(activePlayerIds: Set<string>): WorldSnapshot {
  const players = Object.values(worldState.players)
    .map((p) => ({
      ...p,
      isOnline: activePlayerIds.has(p.playerId),
    }))
    .sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || b.fans - a.fans)
    .slice(0, 60);

  return {
    players,
    posts: worldState.posts.slice(0, 120),
    chatMessages: worldState.chatMessages.slice(-200),
    rooms: PUBLIC_ROOMS,
  };
}

// Gemini AI Server Client
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiAi = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    })
  : null;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clientPlayerMap = new Map<WebSocket, string>();

  function getActivePlayerIds(): Set<string> {
    const ids = new Set<string>();
    clientPlayerMap.forEach((pid, ws) => {
      if (ws.readyState === WebSocket.OPEN && pid) {
        ids.add(pid);
      }
    });
    return ids;
  }

  function broadcastEvent(event: ServerWsEvent) {
    const encoded = JSON.stringify(event);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(encoded);
      }
    });
  }

  function upsertPlayer(input: {
    playerId: string;
    stageName: string;
    handle?: string;
    genre: GenreId;
    avatarUrl?: string;
    fans: number;
    monthlyListeners: number;
    totalStreams?: number;
    fame?: number;
    hype?: number;
    topSongTitle?: string;
  }): OnlinePlayerProfile | null {
    const playerId = sanitizeText(input.playerId, 64);
    const stageName = sanitizeText(input.stageName, 36);
    if (!playerId || !stageName) return null;

    const cleanHandle =
      sanitizeText(input.handle, 32) ||
      `@${stageName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'artiste'}`;

    const profile: OnlinePlayerProfile = {
      playerId,
      stageName,
      handle: cleanHandle.startsWith('@') ? cleanHandle : `@${cleanHandle}`,
      genre: input.genre || 'pop',
      avatarUrl: sanitizeAvatarUrl(input.avatarUrl),
      fans: Math.max(0, Number(input.fans) || 0),
      monthlyListeners: Math.max(0, Number(input.monthlyListeners) || 0),
      totalStreams: Math.max(0, Number(input.totalStreams) || 0),
      fame: Math.min(100, Math.max(0, Number(input.fame) || 0)),
      hype: Math.min(100, Math.max(0, Number(input.hype) || 0)),
      verified: (Number(input.fans) || 0) >= 10000,
      isOnline: true,
      lastSeenAt: Date.now(),
      topSongTitle: sanitizeText(input.topSongTitle, 40) || undefined,
    };

    worldState.players[playerId] = profile;
    schedulePersistWorld();
    return profile;
  }

  function createSharedPost(input: {
    id?: string;
    platform: SocialPlatform;
    authorId: string;
    authorName: string;
    authorHandle: string;
    authorAvatar?: string;
    verified?: boolean;
    location?: string;
    tag?: string;
    title?: string;
    content: string;
    mediaTone?: string;
    attachedSongTitle?: string;
    videoDuration?: string;
    initialLikes?: number;
  }): SharedSocialPost | null {
    const validPlatforms: SocialPlatform[] = ['allgram', 'alltok', 'allx', 'alltub', 'allcloud'];
    if (!validPlatforms.includes(input.platform)) return null;

    const content = sanitizeText(input.content, 300);
    const title = sanitizeText(input.title, 70);
    if (!content && !title) return null;

    const id = sanitizeText(input.id, 64) || `post_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    if (worldState.posts.some((p) => p.id === id)) {
      return worldState.posts.find((p) => p.id === id) ?? null;
    }

    const post: SharedSocialPost = {
      id,
      platform: input.platform,
      authorId: sanitizeText(input.authorId, 64) || 'player_anon',
      authorName: sanitizeText(input.authorName, 36) || 'Artiste',
      authorHandle: sanitizeText(input.authorHandle, 34) || '@artiste',
      authorAvatar: sanitizeAvatarUrl(input.authorAvatar),
      verified: Boolean(input.verified),
      isPlayer: true,
      location: sanitizeText(input.location, 40) || undefined,
      tag: sanitizeText(input.tag, 32) || undefined,
      title: title || undefined,
      content,
      mediaTone: sanitizeText(input.mediaTone, 80) || 'from-violet-600/80 via-indigo-700/80 to-slate-900',
      attachedSongTitle: sanitizeText(input.attachedSongTitle, 44) || undefined,
      videoDuration: sanitizeText(input.videoDuration, 12) || undefined,
      likes: Math.max(0, Number(input.initialLikes) || 1),
      likedByIds: [],
      reposts: 0,
      repostedByIds: [],
      views: Math.max(12, (Number(input.initialLikes) || 1) * 14),
      comments: [],
      createdAt: Date.now(),
    };

    worldState.posts = [post, ...worldState.posts].slice(0, 120);
    schedulePersistWorld();
    broadcastEvent({ type: 'social:created', payload: post });
    return post;
  }

  function createChatMessage(input: {
    id?: string;
    roomId: string;
    senderId: string;
    senderName: string;
    senderHandle: string;
    senderAvatar?: string;
    text: string;
  }): SharedChatMessage | null {
    const roomId = sanitizeText(input.roomId, 140);
    const text = sanitizeText(input.text, 500);
    if (!roomId || !text) return null;

    const id = sanitizeText(input.id, 64) || `msg_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    if (worldState.chatMessages.some((m) => m.id === id)) {
      return worldState.chatMessages.find((m) => m.id === id) ?? null;
    }

    const msg: SharedChatMessage = {
      id,
      roomId,
      senderId: sanitizeText(input.senderId, 64) || 'anon',
      senderName: sanitizeText(input.senderName, 36) || 'Artiste',
      senderHandle: sanitizeText(input.senderHandle, 34) || '@artiste',
      senderAvatar: sanitizeAvatarUrl(input.senderAvatar),
      text,
      createdAt: Date.now(),
    };

    worldState.chatMessages = [...worldState.chatMessages, msg].slice(-250);
    schedulePersistWorld();
    broadcastEvent({ type: 'chat:message', payload: msg });
    return msg;
  }

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({
      type: 'world:init',
      payload: getWorldSnapshot(getActivePlayerIds()),
    } satisfies ServerWsEvent));

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as { type: string; payload?: any };
        if (!parsed || typeof parsed.type !== 'string') return;

        if (parsed.type === 'player:presence' && parsed.payload) {
          const profile = upsertPlayer(parsed.payload);
          if (profile) {
            clientPlayerMap.set(ws, profile.playerId);
            broadcastEvent({
              type: 'players:update',
              payload: getWorldSnapshot(getActivePlayerIds()).players,
            });
          }
        } else if (parsed.type === 'chat:send' && parsed.payload) {
          createChatMessage(parsed.payload);
        } else if (parsed.type === 'social:create' && parsed.payload) {
          createSharedPost(parsed.payload);
        } else if (parsed.type === 'social:like' && parsed.payload) {
          const postId = sanitizeText(parsed.payload.postId, 64);
          const actorId = sanitizeText(parsed.payload.playerId, 64);
          if (!postId || !actorId) return;
          const post = worldState.posts.find((p) => p.id === postId);
          if (!post) return;
          const already = post.likedByIds.includes(actorId);
          post.likedByIds = already
            ? post.likedByIds.filter((id) => id !== actorId)
            : [...post.likedByIds, actorId];
          post.likes = Math.max(0, post.likes + (already ? -1 : 1));
          schedulePersistWorld();
          broadcastEvent({ type: 'social:updated', payload: post });
        } else if (parsed.type === 'social:repost' && parsed.payload) {
          const postId = sanitizeText(parsed.payload.postId, 64);
          const actorId = sanitizeText(parsed.payload.playerId, 64);
          if (!postId || !actorId) return;
          const post = worldState.posts.find((p) => p.id === postId);
          if (!post) return;
          const already = post.repostedByIds.includes(actorId);
          post.repostedByIds = already
            ? post.repostedByIds.filter((id) => id !== actorId)
            : [...post.repostedByIds, actorId];
          post.reposts = Math.max(0, post.reposts + (already ? -1 : 1));
          schedulePersistWorld();
          broadcastEvent({ type: 'social:updated', payload: post });
        } else if (parsed.type === 'social:comment' && parsed.payload) {
          const postId = sanitizeText(parsed.payload.postId, 64);
          const text = sanitizeText(parsed.payload.text, 240);
          if (!postId || !text) return;
          const post = worldState.posts.find((p) => p.id === postId);
          if (!post) return;
          const commentId =
            sanitizeText(parsed.payload.commentId, 64) ||
            `cmt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          if (post.comments.some((c) => c.id === commentId)) return;
          const cmt: SharedComment = {
            id: commentId,
            authorId: sanitizeText(parsed.payload.authorId, 64) || 'anon',
            authorName: sanitizeText(parsed.payload.authorName, 36) || 'Artiste',
            authorHandle: sanitizeText(parsed.payload.authorHandle, 34) || '@artiste',
            authorAvatar: sanitizeAvatarUrl(parsed.payload.authorAvatar),
            text,
            createdAt: Date.now(),
          };
          post.comments = [...post.comments, cmt].slice(-40);
          schedulePersistWorld();
          broadcastEvent({ type: 'social:updated', payload: post });
        }
      } catch {
        // ignore malformed frames
      }
    });

    ws.on('close', () => {
      clientPlayerMap.delete(ws);
      broadcastEvent({
        type: 'players:update',
        payload: getWorldSnapshot(getActivePlayerIds()).players,
      });
    });
  });

  // REST Endpoints
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, onlinePlayers: getActivePlayerIds().size });
  });

  app.get('/api/world/init', (_req, res) => {
    res.json(getWorldSnapshot(getActivePlayerIds()));
  });

  app.post('/api/world/presence', (req, res) => {
    const profile = upsertPlayer(req.body ?? {});
    if (!profile) {
      res.status(400).json({ error: 'Profil joueur invalide.' });
      return;
    }
    broadcastEvent({
      type: 'players:update',
      payload: getWorldSnapshot(getActivePlayerIds()).players,
    });
    res.json({ player: profile });
  });

  app.post('/api/chat/send', (req, res) => {
    const msg = createChatMessage(req.body ?? {});
    if (!msg) {
      res.status(400).json({ error: 'Message invalide.' });
      return;
    }
    res.json({ message: msg });
  });

  app.post('/api/social/post', (req, res) => {
    const post = createSharedPost(req.body ?? {});
    if (!post) {
      res.status(400).json({ error: 'Publication invalide.' });
      return;
    }
    res.json({ post });
  });

  app.post('/api/social/comment', (req, res) => {
    const postId = sanitizeText(req.body?.postId, 64);
    const text = sanitizeText(req.body?.text, 240);
    const post = worldState.posts.find((p) => p.id === postId);
    if (!post || !text) {
      res.status(400).json({ error: 'Commentaire invalide.' });
      return;
    }
    const cmt: SharedComment = {
      id: `cmt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      authorId: sanitizeText(req.body?.authorId, 64) || 'anon',
      authorName: sanitizeText(req.body?.authorName, 36) || 'Artiste',
      authorHandle: sanitizeText(req.body?.authorHandle, 34) || '@artiste',
      authorAvatar: sanitizeAvatarUrl(req.body?.authorAvatar),
      text,
      createdAt: Date.now(),
    };
    post.comments = [...post.comments, cmt].slice(-40);
    schedulePersistWorld();
    broadcastEvent({ type: 'social:updated', payload: post });
    res.json({ post });
  });

  // Server-side Gemini AI assistant for industry NPCs & dynamic fan/press reactions
  app.post('/api/ai/chat-reply', async (req, res) => {
    if (!geminiAi) {
      res.status(503).json({ error: 'Clé Gemini non configurée sur le serveur.' });
      return;
    }
    const contactName = sanitizeText(req.body?.contactName, 40) || 'Claire Delacroix';
    const contactRole = sanitizeText(req.body?.contactRole, 50) || 'Conseillère Carrière';
    const userMessage = sanitizeText(req.body?.userMessage, 320);
    const artistSummary = sanitizeText(req.body?.artistSummary, 240);

    if (!userMessage) {
      res.status(400).json({ error: 'Message vide.' });
      return;
    }

    try {
      const response = await geminiAi.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Contexte carrière du joueur : ${artistSummary}\nMessage du joueur : "${userMessage}"`,
        config: {
          systemInstruction: `Tu incarnes ${contactName} (${contactRole}) dans le jeu de simulation musicale ALL STARZ. Réponds en français naturel, concis (1 à 2 phrases percutantes, maximum 45 mots), réaliste par rapport à l'industrie musicale et aux chiffres fournis.`,
        },
      });
      const reply = sanitizeText(response.text, 360);
      res.json({ reply: reply || 'Bien reçu ! Continue sur cette lancée en studio.' });
    } catch (err) {
      console.error('Gemini chat-reply error:', err);
      res.status(502).json({ error: 'Erreur du service Gemini IA.' });
    }
  });

  app.post('/api/ai/social-react', async (req, res) => {
    if (!geminiAi) {
      res.status(503).json({ error: 'Clé Gemini non configurée.' });
      return;
    }
    const postId = sanitizeText(req.body?.postId, 64);
    const post = worldState.posts.find((p) => p.id === postId);
    if (!post) {
      res.status(404).json({ error: 'Post introuvable.' });
      return;
    }
    try {
      const response = await geminiAi.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Plateforme : ${post.platform}\nArtiste : ${post.authorName} (${post.authorHandle})\nContenu : "${post.content}"`,
        config: {
          systemInstruction:
            'Écris un court commentaire de fan ou de média musical en français (max 20 mots) réagissant à cette publication d’artiste. Pas de guillemets superflus.',
        },
      });
      const text = sanitizeText(response.text, 180);
      if (text) {
        const aiComment: SharedComment = {
          id: `ai_cmt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          authorId: 'ai_gemini_fan',
          authorName: 'Rédaction StarFeed',
          authorHandle: '@starfeed_fr',
          isAi: true,
          text,
          createdAt: Date.now(),
        };
        post.comments = [...post.comments, aiComment].slice(-40);
        schedulePersistWorld();
        broadcastEvent({ type: 'social:updated', payload: post });
      }
      res.json({ post });
    } catch (err) {
      console.error('Gemini social-react error:', err);
      res.status(502).json({ error: 'Erreur du service Gemini IA.' });
    }
  });

  // Vite dev middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ALL STARZ full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
