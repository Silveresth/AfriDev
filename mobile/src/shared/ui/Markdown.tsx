import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text as RNText, View } from 'react-native';

import { openLink } from '@/shared/lib';
import { mono, radius, typography, useTheme } from '@/shared/theme';

import { Text } from './Text';

type Block =
  | { kind: 'code'; text: string; lang: string }
  | { kind: 'heading'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; items: string[]; ordered: boolean }
  | { kind: 'paragraph'; text: string };

/** Découpe le Markdown courant des posts : blocs de code, titres, listes, citations, paragraphes. */
function parse(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    const fence = line.match(/^```\s*(\S*)/);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').startsWith('```')) code.push(lines[index++] ?? '');
      index += 1;
      blocks.push({ kind: 'code', text: code.join('\n'), lang: fence[1] ?? '' });
      continue;
    }
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*)/);
    if (heading) {
      blocks.push({ kind: 'heading', text: heading[1] ?? '' });
      index += 1;
      continue;
    }
    const listMatch = line.match(/^\s*([-*+]|\d+[.)])\s+/);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[1] ?? '');
      const items: string[] = [];
      while (index < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'list', items, ordered });
      continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (index < lines.length && (lines[index] ?? '').startsWith('>')) quote.push((lines[index++] ?? '').replace(/^>\s?/, ''));
      blocks.push({ kind: 'quote', text: quote.join(' ') });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && (lines[index] ?? '').trim() && !/^(```|#{1,6}\s|>|\s*([-*+]|\d+[.)])\s)/.test(lines[index] ?? '')) {
      paragraph.push(lines[index++] ?? '');
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join('\n') });
  }
  return blocks;
}

/** Gras, code en ligne et liens à l'intérieur d'un texte. */
function Inline({ text }: { text: string }) {
  const { colors } = useTheme();
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+]\([^)\s]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <RNText key={i} style={styles.bold}>
              {part.slice(2, -2)}
            </RNText>
          );
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <RNText key={i} style={[styles.inlineCode, { backgroundColor: colors.container, color: colors.primaryInk }]}>
              {part.slice(1, -1)}
            </RNText>
          );
        }
        const link = part.match(/^\[([^\]]+)]\(([^)\s]+)\)$/);
        if (link) {
          const url = link[2] ?? '';
          return (
            <RNText
              key={i}
              accessibilityRole="link"
              onPress={() => /^https?:\/\//.test(url) && void openLink(url)}
              style={{ color: colors.primaryInk, textDecorationLine: 'underline' }}
            >
              {link[1]}
            </RNText>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

export function CodeBlock({ code }: { code: string }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.code, { backgroundColor: colors.codeBg }]}
      contentContainerStyle={styles.codeInner}
    >
      <RNText selectable style={[styles.codeText, { color: colors.codeInk }]}>
        {code}
      </RNText>
    </ScrollView>
  );
}

export function Markdown({ source }: { source: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {parse(source).map((block, i) => {
        switch (block.kind) {
          case 'code':
            return <CodeBlock key={i} code={block.text} />;
          case 'heading':
            return (
              <Text key={i} variant="headline">
                <Inline text={block.text} />
              </Text>
            );
          case 'quote':
            return (
              <View key={i} style={[styles.quote, { borderLeftColor: colors.lineStrong }]}>
                <Text tone="muted">
                  <Inline text={block.text} />
                </Text>
              </View>
            );
          case 'list':
            return (
              <View key={i} style={styles.list}>
                {block.items.map((item, n) => (
                  <View key={n} style={styles.listItem}>
                    <Text tone="muted" style={styles.bullet}>
                      {block.ordered ? `${n + 1}.` : '•'}
                    </Text>
                    <Text style={styles.flex}>
                      <Inline text={item} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          default:
            return (
              <Text key={i} selectable>
                <Inline text={block.text} />
              </Text>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  bold: { fontWeight: '700' },
  inlineCode: { fontFamily: mono, fontSize: 13.5 },
  code: { borderRadius: radius.md },
  codeInner: { padding: 14 },
  codeText: { fontFamily: mono, fontSize: 13, lineHeight: 20 },
  quote: { borderLeftWidth: 3, paddingLeft: 12 },
  list: { gap: 6 },
  listItem: { flexDirection: 'row', gap: 8 },
  bullet: { ...typography.body, minWidth: 16 },
  flex: { flex: 1 },
});
