import { router } from 'expo-router';
import { BriefcaseBusiness, CheckCircle2, Code2, ExternalLink, FolderGit2, type LucideIcon, MapPin, MessagesSquare, Sparkles, Star } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionBar, type ReactType, useCardVote, useDeleteCard } from '@/features/engage';
import { errorMessage, PUBLIC_WEB_URL } from '@/shared/api';
import { type Key, useT } from '@/shared/i18n';
import { formatCount, languageColor, openLink, timeAgo } from '@/shared/lib';
import { PressableScale } from '@/shared/motion';
import { radius, useTheme } from '@/shared/theme';
import { Avatar, CodeBlock, TagRow, Text, useToast } from '@/shared/ui';

import type { HomeItem } from './api';
import { PostRow } from './PostRow';

type CardType = Exclude<HomeItem['type'], 'post'>;
type Meta = Record<string, string | number | boolean | null | undefined>;

const LOOK: Record<CardType, { icon: LucideIcon; color: string }> = {
  question: { icon: MessagesSquare, color: '#15803D' },
  snippet: { icon: Code2, color: '#0284C7' },
  project: { icon: FolderGit2, color: '#7C3AED' },
  job: { icon: BriefcaseBusiness, color: '#D97706' },
};

/** Questions et snippets ont un écran dans l'appli ; projets et offres s'ouvrent sur le site. */
function open(type: CardType, id: string, url: string) {
  if (type === 'question') router.push(`/question/${id}`);
  else if (type === 'snippet') router.push(`/snippet/${id}`);
  else void openLink(`${PUBLIC_WEB_URL}${url}`);
}

/** Élément du fil d'accueil mixte : un post complet, ou une carte typée (accent par type). */
export const HomeRow = memo(function HomeRow({ item }: { item: HomeItem }) {
  if (item.type === 'post') return item.post ? <PostRow post={item.post} /> : null;
  return <HomeCardRow item={item} />;
});

function HomeCardRow({ item }: { item: HomeItem }) {
  const { colors } = useTheme();
  const { t } = useT();
  const card = item.card;
  if (!card) return null;
  const type = item.type as CardType;
  const look = LOOK[type];
  const meta = card.meta as Meta;
  const author = card.author;
  const name = author?.display_name || author?.username || t('member');

  return (
    <PressableScale scaleTo={0.99} onPress={() => open(type, item.id, card.url)} style={[styles.row, { borderBottomColor: colors.line }]}>
      <View style={[styles.accent, { backgroundColor: look.color }]} />
      <View style={styles.body}>
        <View style={styles.inline}>
          <Avatar name={name} src={author?.avatar_url} size={22} />
          <Text variant="caption" numberOfLines={1} style={styles.flex}>
            <Text variant="caption" style={styles.strong} onPress={author ? () => router.push(`/u/${author.username}`) : undefined}>
              {name}
            </Text>
            <Text variant="caption" tone="faint">
              {' · '}
              {timeAgo(item.created_at)}
            </Text>
          </Text>
          <View style={[styles.badge, { backgroundColor: `${look.color}1F` }]}>
            <look.icon size={12} color={look.color} />
            <Text variant="caption" style={{ color: look.color, fontWeight: '700' }}>
              {t(`home.type.${type}` as Key)}
            </Text>
          </View>
        </View>

        <Text variant="bodyStrong" numberOfLines={2}>
          {type === 'job' ? `${card.title} · ${String(meta.company ?? '')}` : card.title}
        </Text>
        {type === 'snippet' ? (
          card.excerpt ? <CodeBlock code={card.excerpt} /> : null
        ) : card.excerpt ? (
          <Text variant="small" tone="muted" numberOfLines={2}>
            {card.excerpt}
          </Text>
        ) : null}

        <Facts type={type} meta={meta} />

        <View style={styles.inline}>
          {item.matched_tags.length ? (
            <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
              <Sparkles size={11} color={colors.primaryInk} />
              <Text variant="caption" tone="primary">
                {t('home.matched')}
              </Text>
            </View>
          ) : null}
          <View style={styles.flex}>
            <TagRow tags={card.tags.slice(0, 3)} />
          </View>
          <Action type={type} meta={meta} id={item.id} url={card.url} />
        </View>
        <CardActions item={item} type={type} />
      </View>
    </PressableScale>
  );
}

const EDIT_ROUTES: Partial<Record<CardType, string>> = { question: '/compose/question', snippet: '/compose/snippet' };
const EDIT_LABELS: Partial<Record<CardType, Key>> = { question: 'modify.question', snippet: 'modify.snippet' };

/** Voter, commenter, partager, enregistrer, signaler, modifier, supprimer : sans ouvrir la carte. */
function CardActions({ item, type }: { item: HomeItem; type: CardType }) {
  const share = { title: item.card!.title, path: item.card!.url };
  if (type === 'job' || !item.stats) return <ActionBar share={share} />;
  return <ReactableActions item={item} stats={item.stats} type={type} share={share} />;
}

function ReactableActions({
  item,
  stats,
  type,
  share,
}: {
  item: HomeItem;
  stats: NonNullable<HomeItem['stats']>;
  type: ReactType;
  share: { title: string; path: string };
}) {
  const { t } = useT();
  const toast = useToast();
  const remove = useDeleteCard();
  const vote = useCardVote(type, item.id, stats);
  const route = EDIT_ROUTES[type];
  const label = EDIT_LABELS[type];
  const edit = () =>
    route ? router.push({ pathname: route as never, params: { editId: item.id } }) : void openLink(`${PUBLIC_WEB_URL}${share.path}`);
  return (
    <ActionBar
      vote={{ score: stats.score, value: stats.viewer_vote, onVote: (value) => vote.mutate(value) }}
      thread={type === 'project' ? undefined : { kind: type, id: item.id, count: stats.comment_count }}
      share={share}
      save={{ type, id: item.id }}
      more={{
        report: stats.can_manage ? undefined : { type, id: item.id },
        onEdit: stats.can_manage ? edit : undefined,
        editLabel: label ? t(label) : t('act.open_web'),
        onDelete: stats.can_manage
          ? () =>
              remove.mutate(
                { type, id: item.id },
                { onSuccess: () => toast(t('mod.deleted')), onError: (error) => toast(errorMessage(error), 'error') },
              )
          : undefined,
      }}
    />
  );
}

function Facts({ type, meta }: { type: CardType; meta: Meta }) {
  const { colors } = useTheme();
  const { t } = useT();
  const parts: React.ReactNode[] = [];
  if (type === 'question') {
    parts.push(
      <View key="r" style={styles.inline}>
        {meta.is_resolved ? <CheckCircle2 size={13} color={colors.secondaryInk} /> : null}
        <Text variant="caption" tone={meta.is_resolved ? 'secondary' : 'muted'}>
          {t(meta.is_resolved ? 'home.resolved' : 'home.awaiting')}
        </Text>
      </View>,
      <Text key="a" variant="caption" tone="faint">
        {t('home.answers', { count: formatCount(Number(meta.answer_count ?? 0)) })}
      </Text>,
    );
  } else if (type === 'snippet' || (type === 'project' && meta.language)) {
    parts.push(
      <View key="l" style={styles.inline}>
        <View style={[styles.dot, { backgroundColor: languageColor(String(meta.language ?? '')) }]} />
        <Text variant="caption" tone="muted">
          {String(meta.language ?? '')}
        </Text>
      </View>,
    );
    if (type === 'snippet') {
      parts.push(
        <Text key="n" variant="caption" tone="faint">
          {t('home.lines', { count: formatCount(Number(meta.lines ?? 0)) })}
        </Text>,
      );
    }
  }
  if (type === 'project') {
    parts.push(
      <View key="s" style={styles.inline}>
        <Star size={12} color={colors.tertiary} />
        <Text variant="caption" tone="muted">
          {formatCount(Number(meta.stars ?? 0))}
        </Text>
      </View>,
    );
    if (meta.is_recruiting) {
      parts.push(
        <Text key="rec" variant="caption" tone="secondary">
          {t('home.recruiting')}
        </Text>,
      );
    }
  }
  if (type === 'job') {
    const where = [meta.location, meta.is_remote ? t('home.remote') : null].filter(Boolean).join(' · ');
    if (where) {
      parts.push(
        <View key="loc" style={styles.inline}>
          <MapPin size={12} color={colors.inkFaint} />
          <Text variant="caption" tone="muted">
            {where}
          </Text>
        </View>,
      );
    }
    if (meta.salary_range) {
      parts.push(
        <Text key="sal" variant="caption" style={styles.strong}>
          {String(meta.salary_range)}
        </Text>,
      );
    }
  }
  if (!parts.length) return null;
  return <View style={styles.facts}>{parts}</View>;
}

function Action({ type, meta, id, url }: { type: CardType; meta: Meta; id: string; url: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  let label: Key | null = null;
  let onPress: (() => void) | null = null;
  if (type === 'job' && meta.apply_url) {
    const href = String(meta.apply_url);
    label = 'home.apply';
    onPress = () => void openLink(/^https?:\/\//.test(href) ? href : `mailto:${href}`);
  } else if (type === 'question' && !meta.is_resolved) {
    label = 'home.help';
    onPress = () => open(type, id, url);
  } else if (type === 'project' && meta.repo_url) {
    label = 'home.repo';
    onPress = () => void openLink(String(meta.repo_url));
  }
  if (!label || !onPress) return null;
  return (
    <PressableScale scaleTo={0.92} onPress={onPress} style={[styles.action, { borderColor: colors.lineStrong }]}>
      <Text variant="caption" style={styles.strong}>
        {t(label)}
      </Text>
      {type !== 'question' ? <ExternalLink size={11} color={colors.ink} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strong: { fontWeight: '700' },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  accent: { width: 3 },
  body: { flex: 1, gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
});
