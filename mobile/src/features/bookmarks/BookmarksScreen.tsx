import {
  Bookmark,
  BriefcaseBusiness,
  Code2,
  FolderGit2,
  FolderPlus,
  Globe,
  Lock,
  type LucideIcon,
  MessagesSquare,
  Newspaper,
  Pencil,
  Trash2,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { openLink, timeAgo } from '@/shared/lib';
import { haptic } from '@/shared/motion';
import { radius, useTheme } from '@/shared/theme';
import { Avatar, Button, EmptyState, Header, IconButton, ListFooter, Loading, Sheet, Switch, Text, TextField, useToast } from '@/shared/ui';

import { type BookmarkItem, type Collection, type TargetType, useCollectionActions, useCollectionItems, useCollections, useRemoveItem } from './api';

const TYPES: Record<TargetType, { key: 'bm.type.post' | 'bm.type.question' | 'bm.type.snippet' | 'bm.type.project' | 'bm.type.job'; icon: LucideIcon }> = {
  post: { key: 'bm.type.post', icon: Newspaper },
  question: { key: 'bm.type.question', icon: MessagesSquare },
  snippet: { key: 'bm.type.snippet', icon: Code2 },
  project: { key: 'bm.type.project', icon: FolderGit2 },
  job: { key: 'bm.type.job', icon: BriefcaseBusiness },
};

/** Marque-pages : collections (privées ou publiques) et leur contenu, comme la page /bookmarks du site. */
export function BookmarksScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const collections = useCollections();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Collection | 'new' | null>(null);
  const list = collections.data ?? [];
  const current = list.find((collection) => collection.id === selected) ?? list[0] ?? null;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header title={t('bm.title')} back right={<IconButton icon={FolderPlus} label={t('bm.new')} onPress={() => setEditing('new')} />} />
      {collections.isPending ? (
        <Loading />
      ) : !list.length ? (
        <EmptyState icon={Bookmark} title={t('bm.empty')} body={t('bm.empty_body')} action={{ label: t('bm.new'), onPress: () => setEditing('new') }} />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipBar}>
            {list.map((collection) => {
              const active = collection.id === current?.id;
              const Icon = collection.is_private ? Lock : Globe;
              return (
                <Pressable
                  key={collection.id}
                  onPress={() => {
                    haptic.select();
                    setSelected(collection.id);
                  }}
                  style={[styles.chip, active ? { backgroundColor: colors.primarySoft } : { borderColor: colors.line, borderWidth: 1 }]}
                >
                  <Icon size={13} color={active ? colors.primaryInk : colors.inkMuted} />
                  <Text variant="smallStrong" style={{ color: active ? colors.primaryInk : colors.inkMuted }}>
                    {collection.name}
                  </Text>
                  <Text variant="caption" tone="faint">
                    {collection.item_count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {current ? <CollectionView key={current.id} collection={current} onEdit={() => setEditing(current)} /> : null}
        </>
      )}
      <CollectionSheet
        key={editing === null ? 'closed' : editing === 'new' ? 'new' : editing.id}
        collection={editing === 'new' ? null : editing}
        visible={editing !== null}
        onClose={() => setEditing(null)}
        onCreated={setSelected}
      />
    </View>
  );
}

function CollectionView({ collection, onEdit }: { collection: Collection; onEdit: () => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const items = useCollectionItems(collection.id);
  const remove = useRemoveItem();
  const { remove: removeCollection } = useCollectionActions();

  const confirmDelete = () =>
    Alert.alert(t('bm.delete_title', { name: collection.name }), t('bm.delete_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('dm.delete'),
        style: 'destructive',
        onPress: () => removeCollection.mutate(collection.id, { onSuccess: () => toast(t('bm.deleted')), onError: (e) => toast(errorMessage(e), 'error') }),
      },
    ]);

  return (
    <FlatList
      data={items.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ItemRow item={item} onRemove={() => remove.mutate(item.id)} />}
      onEndReached={items.loadMore}
      refreshControl={<RefreshControl refreshing={items.isRefetching && !items.isFetchingNextPage} onRefresh={() => void items.refetch()} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={[styles.head, { borderBottomColor: colors.line }]}>
          <View style={styles.flex}>
            <Text variant="headline">{collection.name}</Text>
            {collection.description ? (
              <Text variant="small" tone="muted">
                {collection.description}
              </Text>
            ) : null}
            <Text variant="caption" tone="faint">
              {t(collection.is_private ? 'bm.private' : 'bm.public')} · {t('bm.items', { count: collection.item_count })}
            </Text>
          </View>
          <IconButton icon={Pencil} label={t('dm.edit')} size={19} onPress={onEdit} />
          <IconButton icon={Trash2} label={t('dm.delete')} size={19} color={colors.danger} onPress={confirmDelete} />
        </View>
      }
      ListEmptyComponent={items.isPending ? <Loading /> : <EmptyState icon={Bookmark} title={t('bm.collection_empty')} body={t('bm.collection_empty_body')} />}
      ListFooterComponent={<ListFooter loading={items.isFetchingNextPage} />}
      contentContainerStyle={styles.grow}
    />
  );
}

function ItemRow({ item, onRemove }: { item: BookmarkItem; onRemove: () => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const type = TYPES[item.target_type];
  const target = item.target;
  return (
    <Pressable
      disabled={!target}
      onPress={() => target && void openLink(target.href)}
      style={({ pressed }) => [styles.item, { borderBottomColor: colors.line }, pressed && { backgroundColor: colors.pressed }]}
    >
      <View style={[styles.itemIcon, { backgroundColor: colors.container }]}>
        <type.icon size={17} color={colors.inkMuted} />
      </View>
      <View style={styles.flex}>
        {target ? (
          <>
            <Text variant="bodyStrong" numberOfLines={2}>
              {target.title}
            </Text>
            {target.excerpt ? (
              <Text variant="small" tone="muted" numberOfLines={1}>
                {target.excerpt}
              </Text>
            ) : null}
            <View style={styles.meta}>
              {target.author ? <Avatar name={target.author.display_name} src={target.author.avatar_url} size={16} /> : null}
              <Text variant="caption" tone="faint" numberOfLines={1} style={styles.flex}>
                {t(type.key)}
                {target.author ? ` · ${target.author.display_name}` : ''} · {timeAgo(item.saved_at)}
              </Text>
            </View>
          </>
        ) : (
          <Text variant="small" tone="faint" style={styles.italic}>
            {t('bm.unavailable', { type: t(type.key) })}
          </Text>
        )}
      </View>
      <IconButton icon={X} label={t('bm.remove')} size={18} onPress={onRemove} />
    </Pressable>
  );
}

function CollectionSheet({
  collection,
  visible,
  onClose,
  onCreated,
}: {
  collection: Collection | null;
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const { create, update } = useCollectionActions();
  const [form, setForm] = useState({
    name: collection?.name ?? '',
    description: collection?.description ?? '',
    is_private: collection?.is_private ?? true,
  });

  const submit = async () => {
    try {
      if (collection) {
        await update.mutateAsync({ id: collection.id, ...form });
        toast(t('bm.updated'));
      } else {
        const created = await create.mutateAsync(form);
        onCreated(created.id);
        toast(t('bm.created', { name: created.name }));
      }
      onClose();
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t(collection ? 'bm.edit' : 'bm.new')}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.form}>
        <TextField label={t('bm.name')} value={form.name} maxLength={60} onChangeText={(name) => setForm({ ...form, name })} placeholder={t('bm.new_ph')} />
        <TextField
          label={t('bm.description')}
          value={form.description}
          maxLength={300}
          multiline
          onChangeText={(description) => setForm({ ...form, description })}
        />
        <View style={[styles.privacy, { borderColor: colors.line }]}>
          <View style={styles.flex}>
            <Text variant="smallStrong">{t('bm.private_label')}</Text>
            <Text variant="caption" tone="muted">
              {t('bm.private_desc')}
            </Text>
          </View>
          <Switch label={t('bm.private_label')} value={form.is_private} onChange={(is_private) => setForm({ ...form, is_private })} />
        </View>
        <Button label={t(collection ? 'bm.save' : 'bm.create')} block disabled={!form.name.trim()} loading={create.isPending || update.isPending} onPress={() => void submit()} />
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  italic: { fontStyle: 'italic' },
  chipBar: { flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  itemIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  form: { gap: 14, paddingHorizontal: 20, paddingBottom: 8 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
});
