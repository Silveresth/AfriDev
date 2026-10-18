'use client';

import { Clock, Coffee, Hand, Heart, Laptop, PartyPopper, Smile } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/shared/lib';

/**
 * Sélecteur d'emojis du chat : catalogue embarqué (aucune dépendance, aucun réseau, utilisable
 * hors ligne) et « récents » gardés sur l'appareil.
 */
const CATEGORIES = [
  {
    key: 'smileys',
    label: 'Smileys',
    icon: Smile,
    emojis: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠',
  },
  {
    key: 'gestures',
    label: 'Gestes',
    icon: Hand,
    emojis: '👍 👎 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 👏 🙌 👐 🤲 💪 🦾 ✍️ 💅 🫶 👀 🧠 🫡 🤷 🤦 🙋 🙇 💁 🙆 🙅',
  },
  {
    key: 'hearts',
    label: 'Cœurs',
    icon: Heart,
    emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟 ⚡',
  },
  {
    key: 'celebration',
    label: 'Fête',
    icon: PartyPopper,
    emojis: '🎉 🎊 🎈 🎁 🏆 🥇 🥈 🥉 🏅 🎖️ 🎯 🎮 🎲 🎵 🎶 🎤 🎧 🎬 📸 🚀 🌍 🌞 🌙 🌈 ☀️ ⛅ 🌧️ ❄️ 🌴 🌺',
  },
  {
    key: 'food',
    label: 'Nourriture',
    icon: Coffee,
    emojis: '☕ 🍵 🧃 🥤 🍺 🍻 🥂 🍷 🍕 🍔 🍟 🌭 🥪 🌮 🌯 🍗 🍖 🍚 🍛 🍜 🍲 🥗 🍿 🍩 🍪 🎂 🍰 🍫 🍬 🍎 🍌 🍉 🍇 🍓 🥭 🍍 🥑',
  },
  {
    key: 'tech',
    label: 'Objets',
    icon: Laptop,
    emojis: '💻 🖥️ ⌨️ 🖱️ 📱 📲 🔋 🔌 💾 💿 📡 🛰️ 🤖 👾 🐛 🐞 🔧 🔨 🛠️ ⚙️ 🧪 🔬 💡 📚 📖 📝 ✏️ 📌 📎 📊 📈 📉 🗂️ 📅 ⏰ ⏳ 🔒 🔑 💰 💸 💳 📦 📢 🔔 ✅ ❌ ⚠️ ❓ ❗',
  },
].map((category) => ({ ...category, emojis: category.emojis.split(' ') }));

const RECENT_KEY = 'afridev:recent-emojis';
const RECENT_MAX = 24;

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecent(emoji: string) {
  try {
    const next = [emoji, ...readRecent().filter((item) => item !== emoji)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : pas de récents */
  }
}

export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const [recent] = useState(readRecent);
  const [tab, setTab] = useState<string>(() => (recent.length ? 'recent' : 'smileys'));
  const panel = useRef<HTMLDivElement>(null);

  // Fermeture : clic à l'extérieur ou Échap.
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (panel.current && !panel.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const tabs = [...(recent.length ? [{ key: 'recent', label: 'Récents', icon: Clock, emojis: recent }] : []), ...CATEGORIES];
  const current = tabs.find((item) => item.key === tab) ?? tabs[0]!;

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="Emojis"
      className="animate-pop absolute right-0 bottom-full z-30 mb-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-card shadow-raised"
    >
      <div className="flex items-center gap-0.5 border-b border-line px-1.5 py-1" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={item.key === current.key}
            aria-label={item.label}
            title={item.label}
            onClick={() => setTab(item.key)}
            className={cn(
              'flex size-8 items-center justify-center rounded-lg transition-colors',
              item.key === current.key ? 'bg-primary-soft text-primary-ink' : 'text-ink-faint hover:bg-container hover:text-ink',
            )}
          >
            <item.icon className="size-4" aria-hidden />
          </button>
        ))}
      </div>
      <p className="px-3 pt-2 text-label-sm font-semibold text-ink-faint">{current.label}</p>
      <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto p-2" role="tabpanel">
        {current.emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              saveRecent(emoji);
              onPick(emoji);
            }}
            className="flex size-9 items-center justify-center rounded-lg text-[1.35rem] leading-none transition-transform hover:scale-110 hover:bg-container"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
